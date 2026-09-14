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

// Valid lifecycle:
// Pending -> Reserved -> Paid
//                     -> Failed   (payment failed, stock released)
//                     -> Expired  (reservation timed out, stock released)
// Reserved/Paid       -> Cancelled (manual cancel, stock released if it had been held)
const STATUSES = ['Pending', 'Reserved', 'Paid', 'Cancelled', 'Expired', 'Failed'];

const orderSchema = new mongoose.Schema(
  {
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: STATUSES, default: 'Pending' },

    // Prevents duplicate order creation for the same client-side cart submission.
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },

    // Guards against double payment submissions for the same order.
    paymentLock: { type: Boolean, default: false },
    paymentIdempotencyKey: { type: String, default: null },

    reservedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Order', orderSchema);
