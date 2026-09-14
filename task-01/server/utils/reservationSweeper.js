const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

/**
 * Safety-net background job: even though payment attempts also check
 * expiry inline, a reservation might simply be abandoned (user closes tab).
 * This sweeper runs every SWEEP_INTERVAL_MS and releases stock for any
 * Reserved order whose expiresAt has passed, flipping it to Expired.
 */
const SWEEP_INTERVAL_MS = 15 * 1000;

async function sweepExpiredReservations() {
  const now = new Date();
  const expiredOrders = await Order.find({ status: 'Reserved', expiresAt: { $lt: now } });

  for (const order of expiredOrders) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Re-check status inside the transaction so we never double-release stock
        // if a payment request processed it in the meantime.
        const fresh = await Order.findOneAndUpdate(
          { _id: order._id, status: 'Reserved' },
          { $set: { status: 'Expired' } },
          { new: true, session }
        );
        if (!fresh) return; // someone else already transitioned it
        for (const line of fresh.items) {
          await Product.findByIdAndUpdate(
            line.product,
            { $inc: { stock: line.quantity } },
            { session }
          );
        }
      });
    } catch (err) {
      console.error('Reservation sweep error for order', order._id.toString(), err.message);
    } finally {
      session.endSession();
    }
  }
}

function startReservationSweeper() {
  setInterval(sweepExpiredReservations, SWEEP_INTERVAL_MS);
  console.log(`Reservation sweeper running every ${SWEEP_INTERVAL_MS / 1000}s`);
}

module.exports = { startReservationSweeper, sweepExpiredReservations };
