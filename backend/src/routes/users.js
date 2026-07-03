const express = require('express');
const router = express.Router();
const { getAllUsers, getProfessionals, updateAvailability, getUserById, updateUserRole, savePushToken, getStats} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');


router.get('/', protect, getAllUsers);
router.get('/professionals', protect, getProfessionals);
router.put('/availability', protect, updateAvailability);
router.put('/:id/role', protect, authorize('secretary', 'president'), updateUserRole);
router.put('/push-token', protect, savePushToken);
router.get('/stats', protect, getStats);
router.get('/:id', protect, getUserById);


module.exports = router;