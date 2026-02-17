const express = require('express');
const router = express.Router();
const {
  initIconePayment,
  handleIconeWebhook,
  handlePaymentSuccess,
  handlePaymentCancel,
  checkPaymentStatus,
  cancelOrder
} = require('../controllers/iconePaymentController');
const { authenticate } = require('../middlewares/authMiddleware');

router.post('/init', authenticate, initIconePayment);

// Webhook endpoint 
router.post('/webhook', handleIconeWebhook);
router.get('/success', handlePaymentSuccess);

router.get('/cancel', handlePaymentCancel);

router.get('/status/:orderId', authenticate, checkPaymentStatus);

// Manual order cancellation from app
router.post('/cancel-order/:orderId', authenticate, cancelOrder);

module.exports = router;
