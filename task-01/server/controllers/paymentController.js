const mongoose = require('mongoose');
const Order = require('../models/Order');
const { releaseStock } = require('./orderController');

/**
 * Mock payment gateway. `outcome` is one of 'success' | 'failure' | 'timeout'
 * (in a real gateway this would come from a webhook/callback instead).
 *
 * Duplicate-submission protection works in two layers:
 *  1. paymentIdempotencyKey: replaying the exact same payment request returns
 *     the original result instead of re-processing.
 *  2. paymentLock: an atomic findOneAndUpdate flips Reserved->locked in one
 *     step, so two simultaneous "pay" clicks for the same order can't both
 *     pass the check - only one wins the lock, the other gets 409.
 */
exports.processPayment = async (req, res, next) => {
  const { outcome, paymentIdempotencyKey } = req.body;
  const { id } = req.params;

  if (!['success', 'failure', 'timeout'].includes(outcome)) {
    return res.status(400).json({ message: "outcome must be 'success', 'failure' or 'timeout'" });
  }
  if (!paymentIdempotencyKey) {
    return res.status(400).json({ message: 'paymentIdempotencyKey is required' });
  }

  try {
    const existing = await Order.findById(id);
    if (!existing) return res.status(404).json({ message: 'Order not found' });

    // Replay of an already-processed payment -> return the same result, no re-processing.
    if (existing.paymentIdempotencyKey === paymentIdempotencyKey && existing.status !== 'Reserved') {
      return res.status(200).json({ order: existing, deduped: true });
    }

    const now = new Date();

    // Reservation timed out before payment arrived.
    if (existing.status === 'Reserved' && existing.expiresAt && existing.expiresAt < now) {
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const fresh = await Order.findById(id).session(session);
        if (fresh.status === 'Reserved') {
          await releaseStock(fresh, session);
          fresh.status = 'Expired';
          await fresh.save({ session });
        }
      });
      session.endSession();
      const expired = await Order.findById(id);
      return res.status(409).json({ message: 'Reservation expired before payment', order: expired });
    }

    // Atomically acquire the payment lock. Only one concurrent request can win this.
    const locked = await Order.findOneAndUpdate(
      { _id: id, status: 'Reserved', paymentLock: { $ne: true } },
      { $set: { paymentLock: true, paymentIdempotencyKey } },
      { new: true }
    );

    if (!locked) {
      const current = await Order.findById(id);
      return res.status(409).json({
        message: 'Order is not in a payable state, or a payment is already in progress',
        order: current,
      });
    }

    if (outcome === 'success') {
      locked.status = 'Paid';
      locked.paidAt = new Date();
      await locked.save();
      return res.json({ order: locked });
    }

    // failure or timeout -> release stock and mark accordingly
    const session = await mongoose.startSession();
    let finalOrder;
    await session.withTransaction(async () => {
      const fresh = await Order.findById(id).session(session);
      await releaseStock(fresh, session);
      fresh.status = outcome === 'failure' ? 'Failed' : 'Expired';
      await fresh.save({ session });
      finalOrder = fresh;
    });
    session.endSession();
    res.json({ order: finalOrder });
  } catch (err) {
    next(err);
  }
};
