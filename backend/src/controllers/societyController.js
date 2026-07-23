const Society = require('../models/Society');
const User = require('../models/User');
const { PLAN_TIERS } = require('../models/Society');

// Count distinct households, not user accounts — several residents of one
// house are one family for both the home stats card and plan limits.
// Mirrors the normalization in userController.getStats.
const normalizeHouse = (h) => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const countFamilies = async (societyId) => {
  const users = await User.find({ societyId, isActive: true }).select('houseNo');
  return new Set(users.map((u) => normalizeHouse(u.houseNo))).size;
};

exports.countFamilies = countFamilies;

// @route GET /api/societies/lookup?code=ABC123
// Public: lets the register screen resolve an invite code to a society so
// the resident can confirm they're joining the right community, and so the
// block list can be populated. Deliberately returns only public fields.
exports.lookupByInviteCode = async (req, res) => {
  try {
    const code = (req.query.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ message: 'Invite code is required' });

    const society = await Society.findOne({ inviteCode: code, isActive: true });
    if (!society) return res.status(404).json({ message: 'No society found for that invite code' });

    const families = await countFamilies(society._id);
    const isFull = society.plan === 'free' && families >= society.maxFamilies;

    res.json({
      success: true,
      society: {
        _id: society._id,
        name: society.name,
        city: society.city,
        state: society.state,
        blocks: society.blocks,
        isFull,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/societies
// Public: creates a new society. The caller is NOT yet a user — they
// register immediately afterwards with the returned invite code and become
// the society's first admin.
exports.createSociety = async (req, res) => {
  try {
    const { name, city, state, blocks } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Society name is required' });
    }

    const inviteCode = await Society.generateInviteCode();
    const society = await Society.create({
      name: name.trim(),
      city: (city || '').trim(),
      state: (state || '').trim(),
      blocks: Array.isArray(blocks) ? blocks.filter((b) => b && b.trim()).map((b) => b.trim()) : [],
      inviteCode,
    });

    res.status(201).json({
      success: true,
      society: {
        _id: society._id,
        name: society.name,
        city: society.city,
        state: society.state,
        blocks: society.blocks,
        inviteCode: society.inviteCode,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/societies/mine
// The signed-in user's own society, including plan usage.
exports.getMySociety = async (req, res) => {
  try {
    const society = await Society.findById(req.societyId);
    if (!society) return res.status(404).json({ message: 'Society not found' });

    const families = await countFamilies(society._id);
    const tier = PLAN_TIERS[society.plan] || PLAN_TIERS.free;

    res.json({
      success: true,
      society: {
        _id: society._id,
        name: society.name,
        city: society.city,
        state: society.state,
        blocks: society.blocks,
        plan: society.plan,
        planExpiresAt: society.planExpiresAt,
        maxFamilies: society.maxFamilies,
        annualPrice: tier.annualPrice,
        families,
        // Only the free tier is hard-capped; paid societies that outgrow
        // their tier are handled commercially rather than blocked.
        isFull: society.plan === 'free' && families >= society.maxFamilies,
        // Admins need the code to invite residents.
        inviteCode: req.user.role === 'societyAdmin' ? society.inviteCode : undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/societies/mine
// Society admin edits their community's details (name, blocks, etc).
exports.updateMySociety = async (req, res) => {
  try {
    const society = await Society.findById(req.societyId);
    if (!society) return res.status(404).json({ message: 'Society not found' });

    const { name, city, state, blocks } = req.body;
    if (name !== undefined) society.name = name.trim();
    if (city !== undefined) society.city = city.trim();
    if (state !== undefined) society.state = state.trim();
    if (Array.isArray(blocks)) {
      society.blocks = blocks.filter((b) => b && b.trim()).map((b) => b.trim());
    }

    await society.save();
    res.json({ success: true, society });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
