const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    price: Number,
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// Pending -> Reserved -> Paid -> Cancelled (+ refunded flag)
//                     -> Failed / Expired  -> Cancelled (no-op, nothing to refund)
const STATUSES = ['Pending', 'Reserved', 'Paid', 'Cancelled', 'Expired', 'Failed'];

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // simple demo auth: client-supplied user id
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: STATUSES, default: 'Pending' },

    idempotencyKey: { type: String, unique: true, sparse: true, index: true },

    paymentLock: { type: Boolean, default: false },
    paymentIdempotencyKey: { type: String, default: null },

    reservedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    refunded: { type: Boolean, default: false },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Order', orderSchema);
