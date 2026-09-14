import { useEffect, useState } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api';

export default function ProductList({ cart, onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', stock: '' });
  const [editingId, setEditingId] = useState(null);

  const load = () => getProducts().then(setProducts).catch(console.error);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, price: Number(form.price), stock: Number(form.stock) };
    if (editingId) await updateProduct(editingId, payload);
    else await createProduct(payload);
    setForm({ name: '', price: '', stock: '' });
    setEditingId(null);
    load();
  };

  const startEdit = (p) => { setEditingId(p._id); setForm({ name: p.name, price: p.price, stock: p.stock }); };
  const remove = async (id) => { await deleteProduct(id); load(); };

  return (
    <div>
      <div className="card">
        <h3>{editingId ? 'Edit product' : 'Add product'}</h3>
        <form onSubmit={submit} className="row" style={{ flexWrap: 'wrap' }}>
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input required type="number" min="0" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <button type="submit">{editingId ? 'Save' : 'Add'}</button>
          {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm({ name: '', price: '', stock: '' }); }}>Cancel</button>}
        </form>
      </div>

      {products.map((p) => (
        <div className="card row" key={p._id}>
          <div>
            <strong>{p.name}</strong> — ${p.price.toFixed(2)}
            <div>Available stock: <strong>{p.stock}</strong></div>
          </div>
          <div className="row">
            <button className="secondary" onClick={() => startEdit(p)}>Edit</button>
            <button className="danger" onClick={() => remove(p._id)}>Delete</button>
            <button disabled={p.stock < 1} onClick={() => onAddToCart(p)}>Add to cart</button>
          </div>
        </div>
      ))}
    </div>
  );
}
