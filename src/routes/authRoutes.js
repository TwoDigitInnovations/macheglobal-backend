const express = require('express');
const {
  login,
  register,
  getUser,
  sendOTP,
  verifyOTP,
  changePassword,
  updateProfile,
  changePasswordfromAdmin,
  forgotPassword,
  resetPassword,
  updatePlayerId,
  verifyAdminOTP,
  verifySellerOTP
} = require('@controllers/authController');
const { sendTestNotification } = require('@controllers/testNotificationController');
const { authenticate } = require('@middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/profile', authenticate, getUser);
router.post('/sendOTP', sendOTP);
router.post('/updateProfile', updateProfile);
router.post('/verifyOTP', verifyOTP);
router.post('/verifyAdminOTP', verifyAdminOTP);
router.post('/verifySellerOTP', verifySellerOTP);
router.post('/changePassword', changePassword);
router.post('/changePasswordfromAdmin', authenticate, changePasswordfromAdmin);
router.post('/update-player-id', authenticate, updatePlayerId);
router.post('/test-notification/:userId', authenticate, sendTestNotification);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
