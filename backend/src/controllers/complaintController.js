const Complaint = require('../models/Complaint');
const sendPushNotification = require('../config/notifications');
const User = require('../models/User');

// @route GET /api/complaints
exports.getComplaints = async (req, res) => {
  try {
    //const query = req.user.role === 'resident' ? { postedBy: req.user._id } : {}; --to conceal the complaint user
    const complaints = await Complaint.find()
      .populate('postedBy', 'name houseNo initials avatarColor')
      .populate('resolvedBy', 'name houseNo initials avatarColor role')
      .populate('comments.user', 'name houseNo initials avatarColor role')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: complaints.length, complaints });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/complaints
exports.createComplaint = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const complaint = await Complaint.create({
      title, description, category,
      postedBy: req.user._id,
    });
    await complaint.populate('postedBy', 'name houseNo initials avatarColor');

    req.io.emit('new_complaint', complaint);
    res.status(201).json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/complaints/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status, resolutionNote } = req.body;
    const updateData = {
      status,
      ...(status === 'resolved' && {
        resolvedAt: Date.now(),
        resolvedBy: req.user._id,
        resolutionNote: resolutionNote || '',
      }),
    };

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('postedBy', 'name houseNo block initials avatarColor role')
      .populate('resolvedBy', 'name houseNo initials avatarColor role')
      .populate('comments.user', 'name houseNo initials avatarColor role');

    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    req.io.emit('complaint_updated', complaint);
    res.json({ success: true, complaint });

    const complaintOwner = await User.findById(complaint.postedBy._id);
if (complaintOwner?.pushToken) {
  await sendPushNotification(
    complaintOwner.pushToken,
    'Complaint Status Updated',
    `Your complaint "${complaint.title}" is now ${status}`,
    { screen: 'complaints', complaintId: complaint._id.toString() }
  );
}
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/complaints/:id/comment
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    complaint.comments.push({ user: req.user._id, text });
    await complaint.save();

    await complaint.populate('postedBy', 'name houseNo block initials avatarColor role');
    await complaint.populate('resolvedBy', 'name houseNo initials avatarColor role');
    await complaint.populate('comments.user', 'name houseNo initials avatarColor role');

    req.io.emit('complaint_updated', complaint);
    res.json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};