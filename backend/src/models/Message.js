const mongoose = require('mongoose');
const tenantScope = require('./plugins/tenantScope');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.plugin(tenantScope);

module.exports = mongoose.model('Message', messageSchema);
