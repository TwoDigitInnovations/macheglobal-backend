const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
    getCreditBalance,
    getCreditTransactions
} = require('../controllers/creditController');

// Get credit balance
router.get('/api/credit/balance', authenticate, getCreditBalance);

// Get credit transaction history
router.get('/api/credit/transactions', authenticate, getCreditTransactions);

module.exports = router;
