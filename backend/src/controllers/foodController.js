const Food = require('../models/Food');
const sendPushNotification = require('../config/notifications');
const User = require('../models/User');

// @route GET /api/food
exports.getFoodPosts = async (req, res) => {
  try {
    const { type } = req.query;
    const query = { status: 'active' };
    if (type) query.type = type;

    // A request with an accepted helper becomes private to the poster and
    // the chosen helper — everyone else's feed should no longer show it.
    query.$or = [
      { selectedOffer: { $exists: false } },
      { selectedOffer: null },
      { postedBy: req.user._id },
      { selectedOffer: req.user._id },
    ];

    const posts = await Food.find(query)
      .populate('postedBy', 'name houseNo initials avatarColor')
      .populate('claimedBy.user', 'name houseNo initials avatarColor')
      .populate('offers.user', 'name houseNo initials avatarColor')
      .populate('offers.comments.user', 'name houseNo initials avatarColor')
      .populate('selectedOffer', 'name houseNo initials avatarColor')
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

    // Once a helper is chosen, offers are closed
    if (post.selectedOffer) {
      return res.status(400).json({ message: 'A helper has already been chosen for this request' });
    }

    // ✅ Check if user already offered
    const alreadyOffered = post.offers.some(
      offer => offer.user.toString() === req.user._id.toString()
    );
    if (alreadyOffered) {
      return res.status(400).json({ message: 'You have already offered to help' });
    }

    post.offers.push({
      user: req.user._id,
      description: (description || '').trim(), // optional comment / pitch
      portions,
      pickupTime,
    });
    await post.save();
    await post.populate('offers.user', 'name houseNo initials avatarColor');

    // Notify the request owner that someone offered to help
    const owner = await User.findById(post.postedBy);
    if (owner?.pushToken) {
      await sendPushNotification(
        owner.pushToken,
        'Someone offered to help! 🙌',
        `${req.user.name} offered to help with your request "${post.title}"`,
        { screen: 'food', postId: post._id.toString() }
      );
    }

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
      .populate('offers.user', 'name houseNo block initials avatarColor')
      .populate('offers.comments.user', 'name houseNo initials avatarColor');
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Once a helper is chosen, this becomes a private thread between the
    // poster and the chosen helper only.
    if (post.selectedOffer) {
      const meId = req.user._id.toString();
      const isOwner = post.postedBy.toString() === meId;
      const isChosenHelper = post.selectedOffer.toString() === meId;
      if (!isOwner && !isChosenHelper) {
        return res.status(403).json({ message: 'You cannot view this' });
      }
    }

    res.json({ success: true, offers: post.offers, selectedOffer: post.selectedOffer });
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

    // Find the offer being accepted
    const acceptedOffer = post.offers.find(o => o._id.toString() === offerId);
    if (!acceptedOffer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    const acceptedUserId = acceptedOffer.user?._id || acceptedOffer.user;

    // Mark it selected by mutating the live subdocument directly (reliably
    // tracked by Mongoose) rather than rebuilding the array via toObject() —
    // that rebuild silently failed to persist isSelected on save, which broke
    // the coordination thread lookup (comments would post but never show).
    acceptedOffer.isSelected = true;
    // Keep ONLY the accepted offer — the rest dissolve. The chosen offer's
    // comment thread stays alive so the two users can coordinate.
    post.offers
      .filter(offer => offer._id.toString() !== offerId)
      .forEach(offer => post.offers.pull(offer._id));
    post.selectedOffer = acceptedUserId;
    // NOTE: keep status 'active' so the request stays reachable for both users
    // to coordinate; it closes when the helper marks the commitment fulfilled.
    await post.save();
    await post.populate('offers.user', 'name houseNo block initials avatarColor');
    await post.populate('offers.comments.user', 'name houseNo initials avatarColor');
    await post.populate('postedBy', 'name houseNo initials avatarColor');

    // Notify the accepted helper so they don't forget their promise
    const helper = await User.findById(acceptedUserId);
    if (helper?.pushToken) {
      await sendPushNotification(
        helper.pushToken,
        'Your offer was accepted! 🤝',
        `${req.user.name} accepted your offer to help with "${post.title}". Please follow through!`,
        { screen: 'food', postId: post._id.toString() }
      );
    }

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


// @route GET /api/food/commitments/mine
// Requests where MY offer was accepted (isSelected) but I haven't marked it done.
// Used to remind the helper of their promise each time they open the app.
exports.getMyCommitments = async (req, res) => {
  try {
    const posts = await Food.find({
      type: 'request',
      selectedOffer: req.user._id,
      offers: { $elemMatch: { user: req.user._id, isSelected: true, fulfilled: { $ne: true } } },
    })
      .populate('postedBy', 'name houseNo block initials avatarColor phone')
      .sort({ updatedAt: -1 });

    const commitments = posts.map((post) => {
      const myOffer = post.offers.find(
        (o) => (o.user?._id || o.user).toString() === req.user._id.toString() && o.isSelected
      );
      return {
        _id: post._id,
        title: post.title,
        description: post.description,
        postedBy: post.postedBy,
        pickupTime: myOffer?.pickupTime || '',
        portions: myOffer?.portions,
        offerId: myOffer?._id,
        acceptedAt: post.updatedAt,
      };
    });

    res.json({ success: true, commitments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/food/:id/commitment/fulfill
// The helper marks their accepted offer as fulfilled (promise kept).
exports.fulfillCommitment = async (req, res) => {
  try {
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const myOffer = post.offers.find(
      (o) => (o.user?._id || o.user).toString() === req.user._id.toString() && o.isSelected
    );
    if (!myOffer) {
      return res.status(403).json({ message: 'You have no accepted offer on this request' });
    }
    myOffer.fulfilled = true;
    await post.save();

    // Let the requester know the helper followed through
    const owner = await User.findById(post.postedBy);
    if (owner?.pushToken) {
      await sendPushNotification(
        owner.pushToken,
        'Help delivered! ✅',
        `${req.user.name} marked their help for "${post.title}" as done`,
        { screen: 'food', postId: post._id.toString() }
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @route POST /api/food/:id/offer/:offerId/comment
// Post a message to an offer's coordination thread. Only the request owner and
// the offerer may participate.
exports.commentOnOffer = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const offer = post.offers.id(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    const meId = req.user._id.toString();
    const isOwner = post.postedBy.toString() === meId;
    const isOfferer = (offer.user?._id || offer.user).toString() === meId;
    if (!isOwner && !isOfferer) {
      return res.status(403).json({ message: 'You cannot comment on this offer' });
    }

    offer.comments.push({ user: req.user._id, text: text.trim() });
    // Nested subdocument arrays occasionally need an explicit nudge so
    // Mongoose reliably persists the change.
    post.markModified('offers');
    await post.save();
    await post.populate('offers.user', 'name houseNo block initials avatarColor');
    await post.populate('offers.comments.user', 'name houseNo initials avatarColor');
    await post.populate('postedBy', 'name houseNo initials avatarColor');

    // Notify the OTHER party in the thread
    const otherId = isOwner ? (offer.user?._id || offer.user) : post.postedBy;
    const other = await User.findById(otherId);
    if (other?.pushToken) {
      await sendPushNotification(
        other.pushToken,
        `New message about "${post.title}"`,
        `${req.user.name}: ${text.trim().slice(0, 80)}`,
        { screen: 'food', postId: post._id.toString() }
      );
    }

    req.io.emit('offer_comment', { postId: post._id, offerId: offer._id, post });
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/food/:id
// Edit a post/request — only the original poster may edit.
exports.updateFoodPost = async (req, res) => {
  try {
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the poster can edit this' });
    }

    const { title, description, category, preferences, portions, photo } = req.body;
    if (title !== undefined) post.title = title;
    if (description !== undefined) post.description = description;
    if (category !== undefined) post.category = category || undefined;
    if (preferences !== undefined) post.preferences = preferences;
    if (photo !== undefined) post.photo = photo;
    if (portions !== undefined) {
      // Keep remainingPortions in sync when the total changes
      const claimed = post.portions - post.remainingPortions;
      post.portions = portions;
      post.remainingPortions = Math.max(0, portions - claimed);
    }

    await post.save();
    await post.populate('postedBy', 'name houseNo initials avatarColor');
    await post.populate('claimedBy.user', 'name houseNo initials avatarColor');
    await post.populate('offers.user', 'name houseNo initials avatarColor');
    await post.populate('offers.comments.user', 'name houseNo initials avatarColor');
    await post.populate('selectedOffer', 'name houseNo initials avatarColor');

    req.io.emit('food_edited', post);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route DELETE /api/food/:id
// Delete a post/request — only the original poster may delete.
exports.deleteFoodPost = async (req, res) => {
  try {
    const post = await Food.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the poster can delete this' });
    }

    await post.deleteOne();
    req.io.emit('food_deleted', { _id: req.params.id, type: post.type });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
