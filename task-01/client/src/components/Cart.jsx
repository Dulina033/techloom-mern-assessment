import { v4 as uuidv4 } from 'uuid';
import { createOrder } from '../api';

export default function Cart({ cart, setCart, onOrderCreated }) {
  const updateQty = (id, qty) => {
    setCart(cart.map((c) => (c.product._id === id ? { ...c, quantity: Math.max(1, qty) } : c)));
  };
  const removeItem = (id) => setCart(cart.filter((c) => c.product._id !== id));

  const total = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);

  const checkout = async () => {
    if (cart.length === 0) return;
    const items = cart.map((c) => ({ productId: c.product._id, quantity: c.quantity }));
    try {
      const res = await createOrder({ items, idempotencyKey: uuidv4() });
      onOrderCreated(res.order);
      setCart([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Checkout failed');
    }
  };

  if (cart.length === 0) return <div className="card">Cart is empty. Add products to begin checkout.</div>;

  return (
    <div className="card">
      <h3>Cart</h3>
      {cart.map((c) => (
        <div className="row" key={c.product._id} style={{ marginBottom: 8 }}>
          <span>{c.product.name} (${c.product.price.toFixed(2)})</span>
          <input
            type="number"
            min="1"
            max={c.product.stock}
            value={c.quantity}
            style={{ width: 60 }}
            onChange={(e) => updateQty(c.product._id, Number(e.target.value))}
          />
          <button className="secondary" onClick={() => removeItem(c.product._id)}>Remove</button>
        </div>
      ))}
      <div className="row">
        <strong>Total: ${total.toFixed(2)}</strong>
        <button onClick={checkout}>Reserve stock & Checkout</button>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280' }}>
        Stock is reserved the moment you click checkout, for 5 minutes.
      </p>
    </div>
  );
}
