const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { canTransition } = require('../utils/orderStateMachine');

const TTL_MINUTES = Number(process.env.RESERVATION_TTL_MINUTES || 5);

/**
 * Create an order from a cart AND atomically reserve stock for every line item.
 * This is the "checkout entry" moment described in the spec: the instant a user
 * enters checkout, stock is reserved for RESERVATION_TTL_MINUTES.
 *
 * Concurrency safety: every decrement uses an atomic
 *   findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
 * inside a single Mongo session/transaction. If ANY item in the cart doesn't
 * have enough stock, the whole transaction aborts and every prior decrement in
 * this request is rolled back automatically by MongoDB. Two requests racing for
 * the last unit can never both succeed, because $gte is evaluated atomically by
 * the storage engine, not read-then-written by our JS code.
 */
exports.createOrder = async (req, res, next) => {
  const { items, idempotencyKey } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items array is required' });
  }
  if (!idempotencyKey) {
    return res.status(400).json({ message: 'idempotencyKey is required to prevent duplicate orders' });
  }

  // Duplicate-submission guard: same cart submitted twice returns the existing order.
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) {
    return res.status(200).json({ order: existing, deduped: true });
  }

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

        // Atomic conditional decrement - this IS the concurrency guarantee.
        const updated = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!updated) {
          throw Object.assign(
            new Error(`Insufficient stock for product ${productId}`),
            { status: 409 }
          );
        }

        resolvedItems.push({
          product: updated._id,
          name: updated.name,
          price: updated.price,
          quantity,
        });
        totalAmount += updated.price * quantity;
      }

      const now = new Date();
      const [created] = await Order.create(
        [
          {
            items: resolvedItems,
            totalAmount,
            status: 'Reserved',
            idempotencyKey,
            reservedAt: now,
            expiresAt: new Date(now.getTime() + TTL_MINUTES * 60 * 1000),
          },
        ],
        { session }
      );
      orderDoc = created;
    });

    res.status(201).json({ order: orderDoc });
  } catch (err) {
    if (err.code === 11000) {
      // Race on idempotencyKey unique index -> another request already created it.
      const dup = await Order.findOne({ idempotencyKey });
      return res.status(200).json({ order: dup, deduped: true });
    }
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  } finally {
    session.endSession();
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
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

/** Release the stock held by an order's items (used by cancel/fail/expire paths). */
async function releaseStock(order, session) {
  for (const line of order.items) {
    await Product.findByIdAndUpdate(
      line.product,
      { $inc: { stock: line.quantity } },
      { session }
    );
  }
}
exports.releaseStock = releaseStock;

/**
 * Cancel an order. Any stock that was held (Reserved or Paid) is restored.
 * Enforces the state machine so e.g. an already-Cancelled order can't be
 * "cancelled" again and double-refund stock.
 */
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

      if (!canTransition(order.status, 'Cancelled')) {
        throw Object.assign(
          new Error(`Cannot cancel an order in status ${order.status}`),
          { status: 409 }
        );
      }

      const hadStockHeld = order.status === 'Reserved' || order.status === 'Paid';
      if (hadStockHeld) await releaseStock(order, session);

      order.status = 'Cancelled';
      order.cancelledAt = new Date();
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
