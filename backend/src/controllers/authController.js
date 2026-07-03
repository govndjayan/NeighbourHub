const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// @route POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, phone, email, password, houseNo, block, profession, designation, isServiceProvider, serviceCategory } = req.body;

    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'User already exists with this phone number' });

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#7b1fa2', '#1565c0', '#00695c', '#e65100', '#c62828', '#4527a0', '#00838f', '#558b2f'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const user = await User.create({
      name, phone, email, password,
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

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 
