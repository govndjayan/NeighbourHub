
const express = require('express');
const router = express.Router();
const { getFoodPosts, createFoodPost, claimFood, offerFood, getFoodOffers, acceptOffer, markOutOfStock} = require('../controllers/foodController');
const { protect } = require('../middleware/auth');


router.get('/', protect, getFoodPosts);
router.post('/', protect, createFoodPost);
router.post('/:id/claim', protect, claimFood);
router.post('/:id/offer', protect, offerFood);
router.get('/:id/offers', protect, getFoodOffers);
router.post('/:id/offer/accept', protect, acceptOffer);
router.put('/:id/outofstock', protect, markOutOfStock);

module.exports = router;