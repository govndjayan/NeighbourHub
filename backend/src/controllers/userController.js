const User = require('../models/User');

// @route GET /api/users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password').sort({ name: 1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/users/professionals
exports.getProfessionals = async (req, res) => {
  try {
    const { category } = req.query;
    const query = { isServiceProvider: true, isActive: true };
    if (category && category !== 'All') query.serviceCategory = category;

    const professionals = await User.find(query).select('-password').sort({ availability: 1 });
    res.json({ success: true, count: professionals.length, professionals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/users/availability
exports.updateAvailability = async (req, res) => {
  try {
    const { availability, availabilityNote } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { availability, availabilityNote },
      { new: true }
    ).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/users/:id
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 

// @route PUT /api/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['resident', 'committee', 'secretary', 'president'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    req.io.emit('user_role_updated', user);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Push Token Endpoinyty
exports.savePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { pushToken });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Stat Card in HOme Page
exports.getStats = async (req, res) => {
  try {
    const User = require('../models/User');
    const Food = require('../models/Food');
    const Complaint = require('../models/Complaint');

    // Unique house numbers — multiple residents of the same house count as
    // ONE family. Normalize away case/spacing/punctuation differences (e.g.
    // "HPA-96", "hpa 96", "HPA96" should all group together).
    const allUsers = await User.find({ isActive: true }).select('houseNo');
    const normalizeHouse = (h) => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueHouses = new Set(allUsers.map(u => normalizeHouse(u.houseNo)));
    const familiesCount = uniqueHouses.size;

    // Food shared this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const foodSharedCount = await Food.countDocuments({
      type: 'share',
      createdAt: { $gte: weekAgo },
    });

    // Open complaints
    const openComplaintsCount = await Complaint.countDocuments({ status: 'open' });

    // Available professionals
    const professionalsCount = await User.countDocuments({
      isServiceProvider: true,
     
      isActive: true,
    });

    res.json({
      success: true,
      stats: {
        families: familiesCount,
        foodShared: foodSharedCount,
        openComplaints: openComplaintsCount,
        professionals: professionalsCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};