const mongoose = require('mongoose');
const crypto = require('crypto');

// Pricing tiers. `maxFamilies` is the inclusive upper bound of each tier —
// a society is billed for the tier its family count falls into. Only the
// free tier is enforced as a hard cap at registration; paid societies that
// outgrow their tier are upgraded commercially, not blocked mid-signup.
const PLAN_TIERS = {
  free: { maxFamilies: 40, annualPrice: 0 },
  starter: { maxFamilies: 100, annualPrice: 12000 },
  growth: { maxFamilies: 250, annualPrice: 18000 },
  scale: { maxFamilies: 500, annualPrice: 30000 },
  enterprise: { maxFamilies: Infinity, annualPrice: null }, // 40k–75k, negotiated
};

const societySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },

  // Residents join by entering this code, which is what resolves them to
  // the right tenant at registration.
  inviteCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

  // Per-society blocks/wings, replacing what used to be a hardcoded list
  // in the frontend.
  blocks: { type: [String], default: [] },

  plan: {
    type: String,
    enum: Object.keys(PLAN_TIERS),
    default: 'free',
  },
  // Denormalized from PLAN_TIERS at save time so a plan's cap is pinned to
  // the society even if pricing tiers are later revised.
  maxFamilies: { type: Number, default: PLAN_TIERS.free.maxFamilies },
  planExpiresAt: { type: Date, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Generate a readable, unambiguous invite code (no O/0/I/1 confusion).
societySchema.statics.generateInviteCode = async function () {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from(
      crypto.randomBytes(6),
      (b) => alphabet[b % alphabet.length]
    ).join('');
    const clash = await this.findOne({ inviteCode: code });
    if (!clash) return code;
  }
  throw new Error('Could not generate a unique invite code');
};

// Keep maxFamilies in step with the selected plan.
societySchema.pre('save', function () {
  if (this.isModified('plan')) {
    this.maxFamilies = PLAN_TIERS[this.plan]?.maxFamilies ?? PLAN_TIERS.free.maxFamilies;
  }
});

module.exports = mongoose.model('Society', societySchema);
module.exports.PLAN_TIERS = PLAN_TIERS;
