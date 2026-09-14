const Product = require('../models/Product');

// CREATE
exports.createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock } = req.body;
    if (!name || price == null || stock == null) {
      return res.status(400).json({ message: 'name, price and stock are required' });
    }
    const product = await Product.create({ name, description, price, stock });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// READ ALL (reflects live/accurate stock since we read straight from the DB)
exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
};

// READ ONE
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// UPDATE
exports.updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { name, description, price, stock } },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// DELETE
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};
