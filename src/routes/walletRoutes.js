const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const walletController = require('../controllers/walletcontroller');

// Seller wallet routes
router.get('/seller/:sellerId', authenticate, walletController.getSellerWallet);
router.post('/withdraw', authenticate, walletController.requestWithdrawal); // Updated path
router.get('/seller/withdrawals/:sellerId', authenticate, walletController.getSellerWithdrawals);

// Admin wallet routes
router.get('/admin/balance', authenticate, walletController.getAdminWallet);
router.get('/admin/withdrawals/pending', authenticate, walletController.getPendingWithdrawals);
router.put('/admin/withdrawals/:id/approve', authenticate, walletController.approveWithdrawal);
router.put('/admin/withdrawals/:id/reject', authenticate, walletController.rejectWithdrawal);
router.get('/admin/withdrawals', authenticate, walletController.getAllWithdrawals);

// Transaction history
router.get('/transactions', authenticate, walletController.getUserTransactions);

// Dashboard stats
router.get('/seller-stats/:sellerId', authenticate, walletController.getSellerStats);
router.get('/admin-stats', authenticate, walletController.getAdminStats);

module.exports = router;
