const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, markAsRead, getConversations} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.get('/conversations', protect, getConversations);
router.get('/:userId', protect, getMessages);
router.post('/:userId', protect, sendMessage);
router.put('/:userId/read', protect, markAsRead);

module.exports = router;