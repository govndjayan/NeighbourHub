const Announcement = require('../models/Announcement');
const sendPushNotification = require('../config/notifications');
const User = require('../models/User');


// @route GET /api/announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('postedBy', 'name houseNo initials avatarColor')
      .sort({ isPinned: -1, createdAt: -1 });
    res.json({ success: true, count: announcements.length, announcements });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, body, tag, isPinned } = req.body;
    const announcement = await Announcement.create({
      title, body, tag, isPinned,
      postedBy: req.user._id,
    });
    await announcement.populate('postedBy', 'name houseNo initials avatarColor');

    const allUsers = await User.find({ isActive: true, pushToken: { $ne: '' } });
await Promise.all(allUsers.map(u =>
  sendPushNotification(
    u.pushToken,
    `📢 ${announcement.tag}: ${announcement.title}`,
    announcement.body,
    { screen: 'home' }
  )
));

    // Emit to all connected clients
    req.io.emit('new_announcement', announcement);

    res.status(201).json({ success: true, announcement });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
    announcement.isActive = false;
    await announcement.save();
    res.json({ success: true, message: 'Announcement removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 

exports.updateAnnouncement = async (req, res) => {
  try {
    const { title, body, tag, isPinned } = req.body;
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { title, body, tag, isPinned },
      { new: true }
    ).populate('postedBy', 'name flatNumber initials avatarColor');
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
    req.io.emit('announcement_updated', announcement);
    res.json({ success: true, announcement });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
