const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Society = require('../models/Society');
const { sendEmail, otpEmailTemplate } = require('../utils/sendEmail');

const generateToken = (user) => {
  // societyId rides in the token so every authenticated request carries its
  // tenant without the client being able to choose one.
  return jwt.sign(
    { id: user._id, societyId: user.societyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  phone: user.phone,
  houseNo: user.houseNo,
  block: user.block,
  role: user.role,
  initials: user.initials,
  avatarColor: user.avatarColor,
  societyId: user.societyId,
});

// @route POST /api/auth/register
// Requires an invite code, which resolves the resident to their society.
exports.register = async (req, res) => {
  try {
    const {
      inviteCode, name, phone, email, password, houseNo, block,
      profession, designation, isServiceProvider, serviceCategory,
    } = req.body;

    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ message: 'A society invite code is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const society = await Society.findOne({
      inviteCode: inviteCode.trim().toUpperCase(),
      isActive: true,
    });
    if (!society) {
      return res.status(404).json({ message: 'No society found for that invite code' });
    }

    // Phone is unique per society, so the same number may exist elsewhere.
    const userExists = await User.findOne({ societyId: society._id, phone });
    if (userExists) {
      return res.status(400).json({ message: 'An account already exists with this phone number in this society' });
    }

    // Email is intentionally NOT unique — multiple residents of the same
    // house may register different accounts under one shared email.

    // The free-tier limit counts households, not accounts, so a second or
    // third member of an already-registered family is never turned away.
    const normalizeHouse = (h) => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = await User.find({ societyId: society._id, isActive: true }).select('houseNo');
    const houses = new Set(existing.map((u) => normalizeHouse(u.houseNo)));
    const families = houses.size;
    const isNewFamily = !houses.has(normalizeHouse(houseNo));

    if (society.plan === 'free' && isNewFamily && families >= society.maxFamilies) {
      return res.status(403).json({
        message: `${society.name} has reached the ${society.maxFamilies}-family limit of the free plan. Please ask your society admin to upgrade.`,
      });
    }

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#7b1fa2', '#1565c0', '#00695c', '#e65100', '#c62828', '#4527a0', '#00838f', '#558b2f'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    // Whoever registers first against a brand-new society becomes its admin.
    const isFirstMember = !(await User.exists({ societyId: society._id }));

    const user = await User.create({
      societyId: society._id,
      name, phone, email: normalizedEmail, password,
      houseNo, block,
      initials, avatarColor,
      profession, designation,
      isServiceProvider, serviceCategory,
      role: isFirstMember ? 'societyAdmin' : 'resident',
    });

    if (isFirstMember) {
      society.createdBy = user._id;
      await society.save();
    }

    res.status(201).json({
      success: true,
      token: generateToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/login
// Body: { phone, password, societyId? }
// Phone is only unique within a society, so in the rare case one number is
// registered in more than one society we ask the caller which to sign in to
// rather than silently picking one.
exports.login = async (req, res) => {
  try {
    const { phone, password, societyId } = req.body;

    const query = societyId ? { phone, societyId } : { phone };
    const candidates = await User.find(query).skipTenantScope();
    if (!candidates.length) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const matches = [];
    for (const candidate of candidates) {
      if (await candidate.matchPassword(password)) matches.push(candidate);
    }
    if (!matches.length) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    if (matches.length > 1) {
      const societies = await Society.find({ _id: { $in: matches.map((m) => m.societyId) } })
        .select('name city');
      return res.status(409).json({
        message: 'This phone number is registered in more than one society. Please choose one.',
        needsSocietyChoice: true,
        societies,
      });
    }

    const user = matches[0];
    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    res.json({
      success: true,
      token: generateToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/forgot-password
// Body: { phone, email }  -> generates OTP, emails it. Always responds generically.
// Both phone and email are required: since email is no longer unique (two
// residents of one house may share it), phone is what pins down the exact
// account to reset.
exports.forgotPassword = async (req, res) => {
  try {
    const { phone, email } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Please enter your phone number' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Please enter your email address' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Generic response used whether or not the account exists (prevents enumeration)
    const genericResponse = {
      success: true,
      message: 'If a matching account exists, a reset code has been sent.',
    };

    // Pre-auth, so there's no session tenant yet — phone+email is looked up
    // across societies and, in the rare multi-society case, we reset the
    // single account whose details match.
    const user = await User.findOne({ phone: phone.trim(), email: normalizedEmail }).skipTenantScope();
    if (!user) return res.json(genericResponse);

    const otp = user.getResetOTP();
    await user.save({ validateBeforeSave: false });

    try {
      const { subject, text, html } = otpEmailTemplate(user.name, otp);
      await sendEmail({ to: user.email, subject, text, html });
    } catch (mailErr) {
      // Roll back the OTP so a failed send doesn't leave a dangling code
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('Reset email failed:', mailErr.message);
      return res.status(500).json({ message: 'Could not send reset email. Please try again later.' });
    }

    return res.json(genericResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/reset-password
// Body: { phone, email, otp, password }  -> verifies OTP + expiry, sets new password
exports.resetPassword = async (req, res) => {
  try {
    const { phone, email, otp, password } = req.body;
    if (!phone || !email || !otp || !password) {
      return res.status(400).json({ message: 'Phone, email, code and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedOTP = crypto.createHash('sha256').update('' + otp).digest('hex');

    // Pre-auth lookup (no session tenant yet); the OTP hash is what
    // identifies the exact account.
    const user = await User.findOne({
      phone: phone.trim(),
      email: normalizedEmail,
      resetPasswordOTP: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordOTP +resetPasswordExpire').skipTenantScope();

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    user.password = password; // pre-save hook re-hashes
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now sign in.',
      token: generateToken(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user._id, societyId: req.societyId }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 
