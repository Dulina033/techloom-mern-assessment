const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    // stock = currently AVAILABLE (unreserved) units.
    // When a unit is reserved it is atomically decremented here so
    // concurrent checkouts can never both "see" the same free unit.
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
