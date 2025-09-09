const express = require('express');
const {
  login,
  register,
  getUser,
  sendOTP,
  verifyOTP,
  changePassword,
  updateProfile,
  changePasswordfromAdmin
} = require('@controllers/authController');
const { authenticate } = require('@middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/profile', authenticate, getUser);
router.post('/sendOTP', sendOTP);
router.post('/updateProfile', updateProfile);
router.post('/verifyOTP', verifyOTP);
router.post('/changePassword', changePassword);
router.post('/changePasswordfromAdmin', authenticate, changePasswordfromAdmin);

module.exports = router;
