const express = require('express');
const { authenticate } = require('@middlewares/authMiddleware');
const product = require('@controllers/product');
const router = express.Router();

// Search products
router.get('/productSearch', product.productSearch);

router.post('/createProduct', product.createProduct);
router.get('/getProduct', product.getProduct);
router.post('/updateProduct', product.updateProduct);
router.delete('/deleteProduct/:id', product.deleteProduct);
router.get('/getProductById/:id', product.getProductById);
router.get('/getProductBySlug', product.getProductBySlug);
router.get('/getProductBycategoryId', product.getProductBycategoryId);
router.get('/getProductbycategory/:id', product.getProductbycategory);
router.post('/createProductRequest', product.requestProduct);
router.get('/getrequestProduct', authenticate, product.getrequestProduct);
router.get('/getHistoryProduct', authenticate, product.getHistoryProduct);
router.get('/getProductByCatgeoryName', product.getProductByCatgeoryName);
router.get('/getColors', product.getColors);
router.get('/getBrand', product.getBrand);
router.post('/getOrderBySeller', authenticate, product.getOrderBySeller);
router.get('/dashboarddetails', product.dashboarddetails);
router.get('/getMonthlySales', product.getMonthlySales);
router.get('/getTopSoldProduct', product.getTopSoldProduct);
router.get('/getLowStockProduct', product.getLowStockProduct);
router.get('/dashboard-stats', product.getDashboardStats);

module.exports = router;
