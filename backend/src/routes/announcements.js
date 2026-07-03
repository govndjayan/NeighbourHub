const express = require('express');
const router = express.Router();

const { getAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement } = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getAnnouncements);
router.post('/', protect, authorize('secretary', 'president'), createAnnouncement);
router.delete('/:id', protect, authorize('secretary'), deleteAnnouncement);
router.put('/:id', protect, authorize('secretary', 'president'), updateAnnouncement);

module.exports = router;