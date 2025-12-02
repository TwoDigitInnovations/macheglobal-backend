const express = require('express');
const router = express.Router();
const { generateInvoice } = require('../controllers/invoiceController');
const { authenticate } = require('../middlewares/authMiddleware');

// Generate invoice for an order
router.get('/:orderId', authenticate, generateInvoice);

module.exports = router;
