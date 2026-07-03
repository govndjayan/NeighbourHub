const Food = require('../models/Food');
const sendPushNotification = require('../config/notifications');
const User = require('../models/User');

// @route GET /api/food
exports.getFoodPosts = async (req, res) => {
  try {
    const { type } = req.query;
    const query = { status: 'active' };
    if (type) query.type = type;

    const posts = await Food.find(query)
      .populate('postedBy', 'name houseNo initials avatarColor')
      .populate('claimedBy.user', 'name houseNo initials avatarColor')
      .populate('offers.user', 'name houseNo initials avatarColor')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: posts.length, posts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/food
exports.createFoodPost = async (req, res) => {
  try {
    const { type, category, title, description, portions, availableTill, neededBy, preferences, isExchange, photo } = req.body;
    console.log('CREATING FOOD POST:', { type, category, title, photo });

    const post = await Food.create({
      type, category, title, description,
      portions, remainingPortions: portions,
      availableTill, neededBy, preferences, isExchange,
      photo,
      postedBy: req.user._id,
    });

    await post.populate('postedBy', 'name houseNo initials avatarColor');
    req.io.emit('new_food_post', post);

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.log('FOOD POST ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/food/:id/claim
exports.claimFood = async (req, res) => {
  try {
    const { quantity } = req.body;
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.remainingPortions < quantity) return res.status(400).json({ message: 'Not enough portions available' });

    post.claimedBy.push({ user: req.user._id, quantity });
    post.remainingPortions -= quantity;
    if (post.remainingPortions === 0) post.status = 'fulfilled';

    await post.save();
    const poster = await User.findById(post.postedBy);
if (poster?.pushToken) {
  await sendPushNotification(
    poster.pushToken,
    'Someone claimed your food! 🍱',
    `${req.user.name} claimed ${quantity} portion(s) of "${post.title}"`,
    { screen: 'food', postId: post._id.toString() }
  );
}

    // Populate before emitting
    await post.populate('postedBy', 'name houseNo initials avatarColor');
    await post.populate('claimedBy.user', 'name houseNo initials avatarColor');

    req.io.emit('food_claimed', post);
    res.json({ success: true, post });

    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/food/:id/offer
exports.offerFood = async (req, res) => {
  try {
    const { description, portions, pickupTime } = req.body;
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // ✅ Check if user already offered
    const alreadyOffered = post.offers.some(
      offer => offer.user.toString() === req.user._id.toString()
    );
    if (alreadyOffered) {
      return res.status(400).json({ message: 'You have already offered to help' });
    }

    post.offers.push({ user: req.user._id, description, portions, pickupTime });
    await post.save();
    await post.populate('offers.user', 'name houseNo initials avatarColor');

    req.io.emit('new_offer', post);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/food/:id/offers
exports.getFoodOffers = async (req, res) => {
  try {
    const post = await Food.findById(req.params.id)
      .populate('offers.user', 'name houseNo block initials avatarColor');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ success: true, offers: post.offers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/food/:id/offer/accept
exports.acceptOffer = async (req, res) => {
  try {
    const { offerId } = req.body;
    const post = await Food.findById(req.params.id)
      .populate('offers.user', 'name houseNo block initials avatarColor');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the requester can accept offers' });
    }

    // Mark selected offer
    post.offers = post.offers.map(offer => ({
      ...offer.toObject(),
      isSelected: offer._id.toString() === offerId,
    }));
    post.status = 'fulfilled';
    await post.save();

    req.io.emit('offer_accepted', post);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markOutOfStock = async (req, res) => {
  try {
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the poster can mark as out of stock' });
    }
    post.status = 'expired';
    post.remainingPortions = 0;
    await post.save();
    await post.populate('postedBy', 'name houseNo initials avatarColor');
    req.io.emit('food_updated', post);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
