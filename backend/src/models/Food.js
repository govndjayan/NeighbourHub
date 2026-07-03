const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String },
  portions: { type: Number },
  pickupTime: { type: String },
  isSelected: { type: Boolean, default: false },
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
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Produce', 'Item'],
    required: true,
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
