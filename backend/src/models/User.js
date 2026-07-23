const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const tenantScope = require('./plugins/tenantScope');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Unique per society, not globally — see the compound index below.
  phone: { type: String, required: true },
  // Not unique: multiple residents of the same house may share one email
  // (e.g. one address used for both accounts at registration).
  email: { type: String, required: true, trim: true, lowercase: true },
  houseNo: { type: String, required: true },
  block: { type: String, required: true },
  residentSince: { type: String },
  initials: { type: String },
  avatarColor: { type: String, default: '#6C63FF' },
  pushToken: { type: String, default: '' },
  password: { type: String, required: true },
  role: {
    type: String,
    // societyAdmin is the person who registered the society — they manage
    // its settings/plan, distinct from the elected committee roles.
    enum: ['resident', 'committee', 'secretary', 'president', 'societyAdmin'],
    default: 'resident',
  },
  profession: { type: String, default: '' },
  designation: { type: String, default: '' },
  isServiceProvider: { type: Boolean, default: false },
  serviceCategory: {
    type: String,
    enum: ['Medical', 'Legal', 'Finance', 'Home', 'Plumber', 'Electrician', 'Other', ''],
    default: '',
  },
  availability: {
    type: String,
    enum: ['online', 'busy', 'offline'],
    default: 'online',
  },
  availabilityNote: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  resetPasswordOTP: { type: String, select: false },
  resetPasswordExpire: { type: Date, select: false },
}, { timestamps: true });

userSchema.plugin(tenantScope);

// A phone number identifies one resident within a society. The same number
// is allowed to exist in a different society (and, in practice, won't).
userSchema.index({ societyId: 1, phone: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


// Generate a 6-digit OTP, store its hash + expiry (10 min), return the plain OTP
userSchema.methods.getResetOTP = function () {
  const otp = ('' + Math.floor(100000 + Math.random() * 900000));
  this.resetPasswordOTP = crypto.createHash('sha256').update(otp).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

module.exports = mongoose.model('User', userSchema); 
