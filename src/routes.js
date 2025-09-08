const authRoutes = require('../src/routes/authRoutes');
const userRoutes =  require('../src/routes/userRoutes');
const ProductRoutes =  require('../src/routes/productRoutes');
const CategoryRoutes =  require('../src/routes/categoryRoutes');
const SaleRoutes =  require('../src/routes/saleRoutes');

module.exports = (app) => {
  app.use('/auth', authRoutes);
  app.use('/user', userRoutes);
  app.use('/product', ProductRoutes);
  app.use('/category', CategoryRoutes);
  app.use('/sale', SaleRoutes);
};
