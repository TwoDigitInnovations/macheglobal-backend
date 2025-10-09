const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
    createOrder,
    getOrderById,
    updateOrderToPaid,
    getMyOrders,
    getOrdersBySeller,
    getOrderDetails
} = require('../controllers/orderController');

// Create a new order
router.post('/api/orders', authenticate, createOrder);


router.get('/api/orders/myorders', authenticate, getMyOrders);


router.get('/api/orders/seller/:sellerId', authenticate, getOrdersBySeller);


router.get('/api/orders/:id', authenticate, getOrderById);


router.put('/api/orders/:id/pay', authenticate, updateOrderToPaid);


router.get('/api/orders/details/:id', getOrderDetails);


router.get('/api/product/getOrderBySeller', authenticate, getOrdersBySeller);

module.exports = router;
