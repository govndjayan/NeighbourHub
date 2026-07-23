const mongoose = require('mongoose');
const tenantScope = require('./plugins/tenantScope');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true },
}, { timestamps: true });

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['Parking', 'Maintenance', 'Noise', 'Security', 'Cleanliness', 'Other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'review', 'resolved'],
    default: 'open',
  },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comments: [commentSchema],
  resolvedAt: { type: Date },
}, { timestamps: true });

complaintSchema.plugin(tenantScope);

module.exports = mongoose.model('Complaint', complaintSchema);
