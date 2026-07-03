const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, trim: true },
  houseNo: { type: String, required: true },
  block: { type: String, required: true },
  residentSince: { type: String },
  initials: { type: String },
  avatarColor: { type: String, default: '#6C63FF' },
  pushToken: { type: String, default: '' },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['resident', 'committee', 'secretary', 'president'],
    default: 'resident',
  },
  profession: { type: String, default: '' },
  designation: { type: String, default: '' },
  isServiceProvider: { type: Boolean, default: false },
  serviceCategory: {
    type: String,
    enum: ['Medical', 'Legal', 'House Help', 'Plumber', 'Electrician', 'Other', ''],
    default: '',
  },
  availability: {
    type: String,
    enum: ['online', 'busy', 'offline'],
    default: 'offline',
  },
  availabilityNote: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 
