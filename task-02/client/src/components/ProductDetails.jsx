export default function ProductDetails({ product, onBack, onAddToCart }) {
  return (
    <div className="card">
      <button className="secondary" onClick={onBack}>← Back to results</button>
      <h2>{product.name}</h2>
      <div style={{ color: '#6b7280' }}>{product.category}</div>
      <p>{product.description || 'No description provided.'}</p>
      <div><strong>${product.price.toFixed(2)}</strong></div>
      <div>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</div>
      <button disabled={product.stock < 1} onClick={() => onAddToCart(product)} style={{ marginTop: 10 }}>
        Add to cart
      </button>
    </div>
  );
}
