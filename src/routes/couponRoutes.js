const express = require('express');
const { authenticate } = require('@middlewares/authMiddleware');
const couponController = require('@controllers/couponController');
const router = express.Router();

// Admin routes
router.post('/createCoupon', authenticate, couponController.createCoupon);
router.get('/getAllCoupons', authenticate, couponController.getAllCoupons);
router.put('/updateCoupon/:id', authenticate, couponController.updateCoupon);
router.delete('/deleteCoupon/:id', authenticate, couponController.deleteCoupon);

// User routes
router.get('/getUserCoupons', authenticate, couponController.getUserCoupons);
router.post('/validateCoupon', authenticate, couponController.validateCoupon);
router.post('/applyCoupon', authenticate, couponController.applyCoupon);

module.exports = router;
