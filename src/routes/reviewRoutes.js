const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticate } = require('@middlewares/authMiddleware');
const { body } = require('express-validator');
const reviewController = require('@controllers/reviewController');
const Order = require('@models/Order');


const reviewValidation = [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot be longer than 2000 characters'),
  body('images')
    .isArray()
    .withMessage('Images must be an array')
];


router.post('/', authenticate, reviewValidation, reviewController.createReview);

router.get('/products/:productId/reviews', reviewController.getProductReviews);


router.get('/', authenticate, (req, res, next) => {
  
  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this resource'
    });
  }
  next();
}, reviewController.getAllReviews);


router.get('/me', authenticate, reviewController.getMyReviews);

router.get(
  '/debug/order/:orderId',
  authenticate,
  async (req, res) => {
    try {
      let order = await Order.findOne({ orderId: req.params.orderId });
      
     
      if (!order && mongoose.Types.ObjectId.isValid(req.params.orderId)) {
        order = await Order.findById(req.params.orderId);
      }
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
          debug: {
            orderId: req.params.orderId,
            userId: req.user._id,
            orderExists: false,
            searchedBy: 'orderId and _id'
          }
        });
      }

      res.json({
        success: true,
        data: {
          _id: order._id,
          user: order.user,
          orderStatus: order.orderStatus,
          orderItems: order.orderItems.map(item => ({
            product: item.product,
            name: item.name,
            qty: item.qty
          })),
          currentUser: req.user._id.toString(),
          isOwner: order.user.toString() === req.user._id.toString()
        }
      });
    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching order',
        error: error.message
      });
    }
  }
);

module.exports = router;
