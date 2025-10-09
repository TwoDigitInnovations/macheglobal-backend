const express = require('express');
const router = express.Router();
const { protect, admin, seller } = require('../middleware/authMiddleware');
const walletController = require('../controllers/walletController');

// Seller wallet routes
router.get('/seller/:sellerId', protect, walletController.getSellerWallet);
router.post('/seller/withdraw', protect, seller, walletController.requestWithdrawal);
router.get('/seller/withdrawals/:sellerId', protect, walletController.getSellerWithdrawals);

// Admin wallet routes
router.get('/admin/balance', protect, admin, walletController.getAdminWallet);
router.get('/admin/withdrawals/pending', protect, admin, walletController.getPendingWithdrawals);
router.put('/admin/withdrawals/:id/approve', protect, admin, walletController.approveWithdrawal);
router.put('/admin/withdrawals/:id/reject', protect, admin, walletController.rejectWithdrawal);
router.get('/admin/withdrawals', protect, admin, walletController.getAllWithdrawals);

// Transaction history
router.get('/transactions', protect, walletController.getUserTransactions);

// Dashboard stats
router.get('/seller-stats/:sellerId', protect, walletController.getSellerStats);
router.get('/admin-stats', protect, admin, walletController.getAdminStats);

module.exports = router;
