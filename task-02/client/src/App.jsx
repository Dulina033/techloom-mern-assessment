import { useState } from 'react';
import ProductList from './components/ProductList.jsx';
import Cart from './components/Cart.jsx';
import OrderHistory from './components/OrderHistory.jsx';

// Demo-only "auth": a plain text userId, entered once, scopes the cart/order history.
export default function App() {
  const [userId, setUserId] = useState(localStorage.getItem('demoUserId') || '');
  const [tab, setTab] = useState('shop');
  const [cart, setCart] = useState([]);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      if (existing) {
        return prev.map((c) => (c.product._id === product._id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const login = (e) => {
    e.preventDefault();
    const val = e.target.elements.userId.value.trim();
    if (!val) return;
    localStorage.setItem('demoUserId', val);
    setUserId(val);
  };

  if (!userId) {
    return (
      <div className="container">
        <h1>Mini Storefront</h1>
        <form className="card" onSubmit={login}>
          <p>Enter any username to simulate a logged-in shopper (no real auth for this demo).</p>
          <input name="userId" placeholder="e.g. jane" />
          <button type="submit" style={{ marginLeft: 8 }}>Continue</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row">
        <h1>Mini Storefront</h1>
        <span>Hi, {userId} · <button className="secondary" onClick={() => { localStorage.removeItem('demoUserId'); setUserId(''); }}>Switch user</button></span>
      </div>
      <div className="tabs">
        <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>Shop</button>
        <button className={tab === 'cart' ? 'active' : ''} onClick={() => setTab('cart')}>Cart ({cart.length})</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Order History</button>
      </div>

      {tab === 'shop' && <ProductList onAddToCart={addToCart} />}
      {tab === 'cart' && <Cart cart={cart} setCart={setCart} userId={userId} onOrderCreated={() => setTab('history')} />}
      {tab === 'history' && <OrderHistory userId={userId} />}
    </div>
  );
}
