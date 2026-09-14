import { useEffect, useState } from 'react';
import { getProducts, getCategories } from '../api';
import ProductDetails from './ProductDetails.jsx';

export default function ProductList({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { getCategories().then(setCategories); }, []);

  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (maxPrice) params.maxPrice = maxPrice;
    getProducts(params).then(setProducts).catch(console.error);
  }, [q, category, maxPrice]);

  if (selected) {
    return <ProductDetails product={selected} onBack={() => setSelected(null)} onAddToCart={onAddToCart} />;
  }

  return (
    <div>
      <div className="filters">
        <input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" placeholder="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ width: 110 }} />
      </div>

      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p._id}>
            <strong>{p.name}</strong>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{p.category}</div>
            <div>${p.price.toFixed(2)}</div>
            <div>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="secondary" onClick={() => setSelected(p)}>Details</button>
              <button disabled={p.stock < 1} onClick={() => onAddToCart(p)}>Add to cart</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <div className="card">No products match your search.</div>}
      </div>
    </div>
  );
}
