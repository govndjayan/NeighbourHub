const express = require('express');
const router = express.Router();
const {
  lookupByInviteCode,
  createSociety,
  getMySociety,
  updateMySociety,
} = require('../controllers/societyController');
const { protect, authorize } = require('../middleware/auth');

// Public — needed before a resident has an account to authenticate with.
router.get('/lookup', lookupByInviteCode);
router.post('/', createSociety);

// Authenticated, scoped to the caller's own society.
router.get('/mine', protect, getMySociety);
router.put('/mine', protect, authorize('societyAdmin', 'secretary', 'president'), updateMySociety);

module.exports = router;
