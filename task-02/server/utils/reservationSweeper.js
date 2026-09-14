const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

const SWEEP_INTERVAL_MS = 15 * 1000;

async function sweepExpiredReservations() {
  const now = new Date();

  const expiredOrders = await Order.find({
    status: 'Reserved',
    expiresAt: { $lte: now },
  });

  for (const order of expiredOrders) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        /*
         * Re-check both status and expiry inside
         * the transaction.
         *
         * This prevents an order that has already
         * been paid/cancelled from being expired.
         */
        const fresh = await Order.findOneAndUpdate(
          {
            _id: order._id,
            status: 'Reserved',
            expiresAt: { $lte: now },
          },
          {
            $set: {
              status: 'Expired',
            },
          },
          {
            new: true,
            session,
          }
        );

        /*
         * Another operation may have changed the order
         * between the initial query and this transaction.
         */
        if (!fresh) {
          return;
        }

        /*
         * Release every reserved item.
         */
        for (const line of fresh.items) {
          await Product.findByIdAndUpdate(
            line.product,
            {
              $inc: {
                stock: line.quantity,
              },
            },
            {
              session,
            }
          );
        }
      });
    } catch (err) {
      console.error(
        'Reservation sweep error for order',
        order._id.toString(),
        err.message
      );
    } finally {
      await session.endSession();
    }
  }
}

function startReservationSweeper() {
  setInterval(
    sweepExpiredReservations,
    SWEEP_INTERVAL_MS
  );

  console.log(
    `Reservation sweeper running every ${
      SWEEP_INTERVAL_MS / 1000
    }s`
  );
}

module.exports = {
  startReservationSweeper,
  sweepExpiredReservations,
};