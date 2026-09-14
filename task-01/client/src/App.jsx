import { useState } from 'react';
import ProductList from './components/ProductList.jsx';
import Cart from './components/Cart.jsx';
import OrderStatus from './components/OrderStatus.jsx';

export default function App() {
  const [tab, setTab] = useState('products');
  const [cart, setCart] = useState([]);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      if (existing) {
        return prev.map((c) =>
          c.product._id === product._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  return (
    <div className="container">
      <h1>POS Order & Inventory System</h1>
      <div className="tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
        <button className={tab === 'cart' ? 'active' : ''} onClick={() => setTab('cart')}>Cart ({cart.length})</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
      </div>

      {tab === 'products' && <ProductList cart={cart} onAddToCart={addToCart} />}
      {tab === 'cart' && <Cart cart={cart} setCart={setCart} onOrderCreated={() => setTab('orders')} />}
      {tab === 'orders' && <OrderStatus />}
    </div>
  );
}
