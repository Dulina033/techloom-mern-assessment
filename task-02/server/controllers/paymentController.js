const mongoose = require('mongoose');
const Order = require('../models/Order');
const { releaseStock } = require('./orderController');

exports.processPayment = async (req, res, next) => {
  const { outcome, paymentIdempotencyKey } = req.body;
  const { id } = req.params;

  if (!['success', 'failure', 'timeout'].includes(outcome)) {
    return res.status(400).json({
      message: "outcome must be 'success', 'failure' or 'timeout'",
    });
  }

  if (!paymentIdempotencyKey) {
    return res.status(400).json({
      message: 'paymentIdempotencyKey is required',
    });
  }

  try {
    /*
     * First check whether this exact payment request
     * has already been processed.
     */
    const existing = await Order.findById(id);

    if (!existing) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    /*
     * Same payment idempotency key + terminal state
     * means this is a duplicate request.
     */
    if (
      existing.paymentIdempotencyKey === paymentIdempotencyKey &&
      ['Paid', 'Failed', 'Expired'].includes(existing.status)
    ) {
      return res.status(200).json({
        order: existing,
        deduped: true,
      });
    }

    /*
     * If the reservation has already expired,
     * release the stock and mark the order as Expired.
     */
    const now = new Date();

    if (
      existing.status === 'Reserved' &&
      existing.expiresAt &&
      existing.expiresAt <= now
    ) {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const fresh = await Order.findOne({
            _id: id,
            status: 'Reserved',
            expiresAt: { $lte: now },
          }).session(session);

          if (!fresh) {
            return;
          }

          await releaseStock(fresh, session);

          fresh.status = 'Expired';
          await fresh.save({ session });
        });
      } finally {
        await session.endSession();
      }

      const expired = await Order.findById(id);

      return res.status(409).json({
        message: 'Reservation expired before payment',
        order: expired,
      });
    }

    /*
     * Atomically acquire the payment lock.
     *
     * IMPORTANT:
     * The reservation must still be valid when
     * the payment lock is acquired.
     */
    const locked = await Order.findOneAndUpdate(
      {
        _id: id,
        status: 'Reserved',
        paymentLock: { $ne: true },
        expiresAt: { $gt: now },
      },
      {
        $set: {
          paymentLock: true,
          paymentIdempotencyKey,
        },
      },
      {
        new: true,
      }
    );

    /*
     * Another payment request may already have acquired
     * the lock.
     */
    if (!locked) {
      const current = await Order.findById(id);

      return res.status(409).json({
        message:
          'Order is not in a payable state, or a payment is already in progress',
        order: current,
      });
    }

    /*
     * PAYMENT SUCCESS
     *
     * Stock remains deducted because the reservation
     * becomes a completed paid order.
     */
    if (outcome === 'success') {
      locked.status = 'Paid';
      locked.paidAt = new Date();

      await locked.save();

      return res.json({
        order: locked,
      });
    }

    /*
     * PAYMENT FAILURE / TIMEOUT
     *
     * Release reserved stock and move the order
     * into the appropriate terminal state.
     */
    const session = await mongoose.startSession();

    let finalOrder;

    try {
      await session.withTransaction(async () => {
        const fresh = await Order.findById(id).session(session);

        if (!fresh) {
          throw Object.assign(
            new Error('Order not found'),
            { status: 404 }
          );
        }

        /*
         * Only release stock if the order is still
         * in the Reserved state.
         */
        if (fresh.status === 'Reserved') {
          await releaseStock(fresh, session);

          fresh.status =
            outcome === 'failure'
              ? 'Failed'
              : 'Expired';

          await fresh.save({ session });
        }

        finalOrder = fresh;
      });
    } finally {
      await session.endSession();
    }

    return res.json({
      order: finalOrder,
    });
  } catch (err) {
    next(err);
  }
};