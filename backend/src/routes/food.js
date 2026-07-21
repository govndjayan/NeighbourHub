
const express = require('express');
const router = express.Router();
const {
  getFoodPosts, createFoodPost, claimFood, offerFood, getFoodOffers, acceptOffer,
  markOutOfStock, getMyCommitments, fulfillCommitment, commentOnOffer,
  updateFoodPost, deleteFoodPost,
} = require('../controllers/foodController');
const { protect } = require('../middleware/auth');


router.get('/', protect, getFoodPosts);
router.get('/commitments/mine', protect, getMyCommitments);
router.post('/', protect, createFoodPost);
router.put('/:id', protect, updateFoodPost);
router.delete('/:id', protect, deleteFoodPost);
router.post('/:id/claim', protect, claimFood);
router.post('/:id/offer', protect, offerFood);
router.get('/:id/offers', protect, getFoodOffers);
router.post('/:id/offer/accept', protect, acceptOffer);
router.post('/:id/offer/:offerId/comment', protect, commentOnOffer);
router.put('/:id/outofstock', protect, markOutOfStock);
router.put('/:id/commitment/fulfill', protect, fulfillCommitment);

module.exports = router;