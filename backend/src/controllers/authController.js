const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail, otpEmailTemplate } = require('../utils/sendEmail');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// @route POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, phone, email, password, houseNo, block, profession, designation, isServiceProvider, serviceCategory } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'User already exists with this phone number' });

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) return res.status(400).json({ message: 'An account with this email already exists' });

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#7b1fa2', '#1565c0', '#00695c', '#e65100', '#c62828', '#4527a0', '#00838f', '#558b2f'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const user = await User.create({
      name, phone, email: normalizedEmail, password,
      houseNo, block, 
      initials, avatarColor,
      profession, designation,
      isServiceProvider, serviceCategory,
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        houseNo: user.houseNo,
        block: user.block,
        role: user.role,
        initials: user.initials,
        avatarColor: user.avatarColor,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ message: 'Invalid phone or password' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid phone or password' });

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        houseNo: user.houseNo,
        block: user.block,
        role: user.role,
        initials: user.initials,
        avatarColor: user.avatarColor,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/forgot-password
// Body: { email }  -> generates OTP, emails it. Always responds generically.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Please enter your email address' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Generic response used whether or not the account exists (prevents enumeration)
    const genericResponse = {
      success: true,
      message: 'If an account with that email exists, a reset code has been sent.',
    };

    const user = await User.findOne({ email: normalizedEmail });
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
// Body: { email, otp, password }  -> verifies OTP + expiry, sets new password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Email, code and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedOTP = crypto.createHash('sha256').update('' + otp).digest('hex');

    const user = await User.findOne({
      email: normalizedEmail,
      resetPasswordOTP: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordOTP +resetPasswordExpire');

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
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 
