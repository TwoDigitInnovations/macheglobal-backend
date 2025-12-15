const Coupon = require('../models/Coupon');
const response = require('../../responses');

module.exports = {
  // Create coupon (Admin)
  createCoupon: async (req, res) => {
    try {
      const couponData = req.body;
      
      // Check if coupon code already exists
      const existingCoupon = await Coupon.findOne({ code: couponData.code.toUpperCase() });
      if (existingCoupon) {
        return res.status(400).json({
          status: false,
          message: 'Coupon code already exists'
        });
      }

      const coupon = new Coupon(couponData);
      await coupon.save();

      return response.ok(res, {
        message: 'Coupon created successfully',
        coupon
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Get all coupons (Admin)
  getAllCoupons: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      if (status === 'active') {
        query.isActive = true;
        query.endDate = { $gte: new Date() };
      } else if (status === 'expired') {
        query.endDate = { $lt: new Date() };
      } else if (status === 'inactive') {
        query.isActive = false;
      }

      const coupons = await Coupon.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalCoupons = await Coupon.countDocuments(query);

      return res.status(200).json({
        status: true,
        data: coupons,
        pagination: {
          totalItems: totalCoupons,
          totalPages: Math.ceil(totalCoupons / limit),
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Get user coupons
  getUserCoupons: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { status = 'available' } = req.query;

      const currentDate = new Date();
      let query = {};

      if (status === 'available') {
        query = {
          isActive: true,
          startDate: { $lte: currentDate },
          endDate: { $gte: currentDate },
          $or: [
            { usageLimit: null },
            { $expr: { $lt: ['$usageCount', '$usageLimit'] } }
          ]
        };
      } else if (status === 'used') {
        query = {
          'usedBy.userId': userId
        };
      } else if (status === 'expired') {
        query = {
          endDate: { $lt: currentDate }
        };
      }

      const coupons = await Coupon.find(query).sort({ createdAt: -1 });

      // Filter coupons based on user usage
      const filteredCoupons = coupons.map(coupon => {
        const userUsage = coupon.usedBy.filter(
          usage => usage.userId.toString() === userId
        );
        
        return {
          ...coupon.toObject(),
          userUsageCount: userUsage.length,
          canUse: userUsage.length < coupon.userUsageLimit
        };
      });

      return response.ok(res, filteredCoupons);
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Validate and apply coupon
  validateCoupon: async (req, res) => {
    try {
      const { code, orderAmount, userId, products } = req.body;

      const coupon = await Coupon.findOne({ 
        code: code.toUpperCase(),
        isActive: true 
      });

      if (!coupon) {
        return res.status(404).json({
          status: false,
          message: 'Invalid coupon code'
        });
      }

      const currentDate = new Date();

      // Check if coupon is expired
      if (coupon.endDate < currentDate) {
        return res.status(400).json({
          status: false,
          message: 'Coupon has expired'
        });
      }

      // Check if coupon has started
      if (coupon.startDate > currentDate) {
        return res.status(400).json({
          status: false,
          message: 'Coupon is not yet active'
        });
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return res.status(400).json({
          status: false,
          message: 'Coupon usage limit reached'
        });
      }

      // Check user usage limit
      const userUsage = coupon.usedBy.filter(
        usage => usage.userId.toString() === userId
      );
      if (userUsage.length >= coupon.userUsageLimit) {
        return res.status(400).json({
          status: false,
          message: 'You have already used this coupon'
        });
      }

      // Check minimum order amount
      if (orderAmount < coupon.minOrderAmount) {
        return res.status(400).json({
          status: false,
          message: `Minimum order amount is ${coupon.minOrderAmount}`
        });
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = (orderAmount * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      return res.status(200).json({
        status: true,
        message: 'Coupon applied successfully',
        coupon: {
          code: coupon.code,
          discountAmount: discountAmount.toFixed(2),
          finalAmount: (orderAmount - discountAmount).toFixed(2)
        }
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Apply coupon to order
  applyCoupon: async (req, res) => {
    try {
      const { code, userId, orderId } = req.body;

      const coupon = await Coupon.findOne({ code: code.toUpperCase() });

      if (!coupon) {
        return res.status(404).json({
          status: false,
          message: 'Coupon not found'
        });
      }

      // Add user to usedBy array
      coupon.usedBy.push({
        userId,
        orderId,
        usedAt: new Date()
      });
      coupon.usageCount += 1;

      await coupon.save();

      return response.ok(res, {
        message: 'Coupon applied successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Update coupon (Admin)
  updateCoupon: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const coupon = await Coupon.findByIdAndUpdate(id, updateData, {
        new: true
      });

      if (!coupon) {
        return res.status(404).json({
          status: false,
          message: 'Coupon not found'
        });
      }

      return response.ok(res, {
        message: 'Coupon updated successfully',
        coupon
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Delete coupon (Admin)
  deleteCoupon: async (req, res) => {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findByIdAndDelete(id);

      if (!coupon) {
        return res.status(404).json({
          status: false,
          message: 'Coupon not found'
        });
      }

      return response.ok(res, {
        message: 'Coupon deleted successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  }
};
