const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const saleRoutes = require('./routes/saleRoutes');
const sellerRoutes = require('./routes/sellerRoutes');

module.exports = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/product', productRoutes);
  app.use('/api/category', categoryRoutes);
  app.use('/api/sale', saleRoutes);
  app.use('/api/seller', sellerRoutes);
};
