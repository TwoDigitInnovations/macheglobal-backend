const express = require('express');
const router = express.Router();
const {
  initIconePayment,
  handleIconeWebhook,
  handlePaymentSuccess,
  handlePaymentCancel,
  checkPaymentStatus
} = require('../controllers/iconePaymentController');
const { authenticate } = require('../middlewares/authMiddleware');

router.post('/init', authenticate, initIconePayment);

// Webhook endpoint 
router.post('/webhook', handleIconeWebhook);
router.get('/success', handlePaymentSuccess);

router.get('/cancel', handlePaymentCancel);

router.get('/status/:orderId', authenticate, checkPaymentStatus);

module.exports = router;
