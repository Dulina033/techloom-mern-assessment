const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { canTransition } = require('../utils/orderStateMachine');

const TTL_MINUTES = Number(process.env.RESERVATION_TTL_MINUTES || 5);

/**
 * Checkout: create the order AND atomically reserve stock for every cart line.
 * Same atomic-conditional-decrement + transaction pattern as task-01, applied
 * to a customer-facing multi-item cart.
 */
exports.checkout = async (req, res, next) => {
  const { userId, items, idempotencyKey } = req.body;

  if (!userId) return res.status(400).json({ message: 'userId is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items array is required' });
  }
  if (!idempotencyKey) {
    return res.status(400).json({ message: 'idempotencyKey is required to prevent duplicate checkout sessions' });
  }

  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return res.status(200).json({ order: existing, deduped: true });

  const session = await mongoose.startSession();
  try {
    let orderDoc;
    await session.withTransaction(async () => {
      const resolvedItems = [];
      let totalAmount = 0;

      for (const line of items) {
        const { productId, quantity } = line;
        if (!productId || !quantity || quantity < 1) {
          throw Object.assign(new Error('Invalid line item'), { status: 400 });
        }

        const updated = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!updated) {
          throw Object.assign(new Error(`Insufficient stock for product ${productId}`), { status: 409 });
        }

        resolvedItems.push({ product: updated._id, name: updated.name, price: updated.price, quantity });
        totalAmount += updated.price * quantity;
      }

      const now = new Date();
      const [created] = await Order.create(
        [{
          userId,
          items: resolvedItems,
          totalAmount,
          status: 'Reserved',
          idempotencyKey,
          reservedAt: now,
          expiresAt: new Date(now.getTime() + TTL_MINUTES * 60 * 1000),
        }],
        { session }
      );
      orderDoc = created;
    });

    res.status(201).json({ order: orderDoc });
  } catch (err) {
    if (err.code === 11000) {
      const dup = await Order.findOne({ idempotencyKey });
      return res.status(200).json({ order: dup, deduped: true });
    }
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  } finally {
    session.endSession();
  }
};

/** Order history for a given user. */
exports.getOrderHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

async function releaseStock(order, session) {
  for (const line of order.items) {
    await Product.findByIdAndUpdate(line.product, { $inc: { stock: line.quantity } }, { session });
  }
}
exports.releaseStock = releaseStock;

/**
 * Cancel an order. If it was Reserved, stock is simply released.
 * If it was Paid, stock is released AND a refund is simulated (refunded=true).
 */
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

      if (!canTransition(order.status, 'Cancelled')) {
        throw Object.assign(new Error(`Cannot cancel an order in status ${order.status}`), { status: 409 });
      }

      const wasPaid = order.status === 'Paid';
      const hadStockHeld = order.status === 'Reserved' || wasPaid;
      if (hadStockHeld) await releaseStock(order, session);

      order.status = 'Cancelled';
      order.cancelledAt = new Date();
      if (wasPaid) {
        order.refunded = true;
        order.refundedAt = new Date();
      }
      await order.save({ session });
      result = order;
    });
    res.json({ order: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * Explicit refund endpoint for orders that failed AFTER being charged in a
 * real gateway (e.g. a chargeback) - simulates issuing money back without
 * changing the order's terminal status, for a paid order that is not being
 * cancelled outright.
 */
exports.refundOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Paid' && order.status !== 'Cancelled') {
      return res.status(409).json({ message: 'Only Paid or Cancelled orders can be refunded' });
    }
    if (order.refunded) return res.status(200).json({ order, deduped: true });

    order.refunded = true;
    order.refundedAt = new Date();
    await order.save();
    res.json({ order });
  } catch (err) {
    next(err);
  }
};
