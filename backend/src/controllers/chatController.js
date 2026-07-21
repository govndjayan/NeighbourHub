const Message = require('../models/Message');
const sendPushNotification = require('../config/notifications');
const User = require('../models/User');

// @route GET /api/chat/:userId
exports.getMessages = async (req, res) => {
  try {
    const roomId = [req.user._id.toString(), req.params.userId].sort().join('_');
    const messages = await Message.find({ roomId })
      .populate('sender', 'name initials avatarColor')
      .populate('receiver', 'name initials avatarColor')
      .sort({ createdAt: 1 });
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/chat/:userId
exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const roomId = [req.user._id.toString(), req.params.userId].sort().join('_');

    const message = await Message.create({
      roomId, text,
      sender: req.user._id,
      receiver: req.params.userId,
    });

    await message.populate('sender', 'name initials avatarColor');
    await message.populate('receiver', 'name initials avatarColor');

    req.io.to(roomId).emit('receive_message', message);

    // Send push notification to receiver
    const receiver = await User.findById(req.params.userId);
    if (receiver?.pushToken) {
      await sendPushNotification(
        receiver.pushToken,
        `New message from ${req.user.name}`,
        text,
        { screen: 'chat', userId: req.user._id.toString() }
      );
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @route PUT /api/chat/:userId/read
exports.markAsRead = async (req, res) => {
  try {
    const roomId = [req.user._id.toString(), req.params.userId].sort().join('_');
    await Message.updateMany(
      { roomId, receiver: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 

// @route GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all messages where user is sender or receiver
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
      .populate('sender', 'name initials avatarColor houseNo designation isServiceProvider phone')
      .populate('receiver', 'name initials avatarColor houseNo designation isServiceProvider phone')
      .sort({ createdAt: -1 });

    // Group by roomId and get last message + unread count
    const conversationMap = {};
    messages.forEach(msg => {
      if (!conversationMap[msg.roomId]) {
        const otherUser = msg.sender._id.toString() === userId.toString()
          ? msg.receiver
          : msg.sender;
        conversationMap[msg.roomId] = {
          roomId: msg.roomId,
          otherUser,
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
        };
      }
      // Count unread messages
      if (
        msg.receiver._id.toString() === userId.toString() &&
        !msg.isRead
      ) {
        conversationMap[msg.roomId].unreadCount += 1;
      }
    });

    const conversations = Object.values(conversationMap)
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
