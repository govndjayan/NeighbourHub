const express = require('express');
const router = express.Router();
const { getComplaints, createComplaint, updateStatus, addComment } = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getComplaints);
router.post('/', protect, createComplaint);
router.put('/:id/status', protect, authorize('secretary', 'president','committee'), updateStatus);
router.post('/:id/comment', protect, addComment);

module.exports = router;