const mongoose = require('mongoose');

const offerCommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true },
}, { timestamps: true });

const offerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String }, // the offerer's initial comment / pitch
  portions: { type: Number },
  pickupTime: { type: String },
  isSelected: { type: Boolean, default: false },
  fulfilled: { type: Boolean, default: false }, // offerer marked their promise done
  comments: [offerCommentSchema], // live 2-way thread, active only after acceptance
}, { timestamps: true });

const claimSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  quantity: { type: Number, default: 1 },
}, { timestamps: true });

const foodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['share', 'request'],
    required: true,
  },
  category: {
    type: String,
    // Optional: allow posts with no category. Empty string / undefined are permitted.
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Produce', 'Item', '', null],
    default: undefined,
  },
  title: { type: String, required: true },
  description: { type: String },
  portions: { type: Number, default: 1 },
  remainingPortions: { type: Number },
  availableFrom: { type: Date },
  availableTill: { type: Date },
  neededBy: { type: Date, default: null},
  preferences: { type: String },
  photo: { type: String },
  isExchange: { type: Boolean, default: false },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  offers: [offerSchema],
  selectedOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claimedBy: [claimSchema],
  status: {
    type: String,
    enum: ['active', 'fulfilled', 'expired', 'cancelled'],
    default: 'active',
  },
}, { timestamps: true });

module.exports = mongoose.model('Food', foodSchema); 
