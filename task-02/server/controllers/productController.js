const Product = require('../models/Product');

exports.createProduct = async (req, res, next) => {
  try {
    const { name, description, category, price, stock, imageUrl } = req.body;
    if (!name || !category || price == null || stock == null) {
      return res.status(400).json({ message: 'name, category, price and stock are required' });
    }
    const product = await Product.create({ name, description, category, price, stock, imageUrl });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

/**
 * Product listing with search + filters:
 *   ?q=text            -> case-insensitive match on name/description
 *   ?category=Shoes
 *   ?minPrice=10&maxPrice=100
 *   ?inStock=true      -> only items with stock > 0
 */
exports.getProducts = async (req, res, next) => {
  try {
    const { q, category, minPrice, maxPrice, inStock } = req.query;
    const filter = {};

    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (inStock === 'true') filter.stock = { $gt: 0 };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { name, description, category, price, stock, imageUrl } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { name, description, category, price, stock, imageUrl } },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (err) {
    next(err);
  }
};
