const User = require('@models/User');
const response = require('../../responses');
const Review = require('@models/Review');
const SellerWallet = require('../models/SellerWallet');
module.exports = {
  giverate: async (req, res) => {
    console.log(req.body);
    try {
      let payload = req.body;
      const re = await Review.findOne({
        product: payload.product,
        posted_by: req.user.id
      });
      console.log(re);
      if (re) {
        re.description = payload.description;
        re.rating = payload.rating;
        await re.save();
      } else {
        payload.posted_by = req.user.id;
        const u = new Review(payload);
        await u.save();
      }

      return response.ok(res, { message: 'successfully' });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getReview: async (req, res) => {
    try {
      const cond = {};
      if (req.params.id) {
        cond.user = req.params.id;
      }

      if (req.body.selectedDate) {
        const date = new Date(req.body.selectedDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        cond.createdAt = {
          $gte: date,
          $lt: nextDay
        };
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const allreview = await Review.find(cond)
        .populate('product posted_by')
        .skip(skip)
        .sort({ createdAt: -1 })
        .limit(limit);

      const totalReviews = await Review.countDocuments(cond);

      // Response
      res.status(200).json({
        success: true,
        data: allreview,
        page,
        totalReviews,
        totalPages: Math.ceil(totalReviews / limit)
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: e.message
      });
    }
  },

  deleteReview: async (req, res) => {
    try {
      const ID = req.params.id;
      console.log(ID);
      const Re = await Review.findByIdAndDelete(ID);
      console.log(Re);

      if (!Re) {
        return response.notFound(res, { message: 'Not Found' });
      }

      return response.ok(res, { message: 'Review deleted successfully' });
    } catch (error) {
      console.log(error);
      return response.error(res, error);
    }
  },

  fileUpload: async (req, res) => {
    try {
      if (!req.file) {
        return response.badRequest(res, { message: 'No file uploaded.' });
      }
      console.log(req.file);
      return response.ok(res, {
        message: 'File uploaded successfully.',
        fileUrl: req.file.path, // Cloudinary file URL
        fileName: req.file.filename // public ID
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getUserList: async (req, res) => {
    try {
      const { type, page = 1, limit = 10 } = req.query; // frontend se aayega
      const cond = { role: type };

      // total count for pagination
      const totalUsers = await User.countDocuments(cond);

      // calculate skip
      const skip = (page - 1) * limit;

      // fetch users with pagination
      const users = await User.find(cond)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      return res.status(200).json({
        status: true,
        data: users,
        pagination: {
          total: totalUsers,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalUsers / limit)
        }
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { Status, SellerId } = req.body;
      console.log('seller', SellerId, Status);
      let seller = await User.findByIdAndUpdate(
        { _id: SellerId },
        { status: Status },
        { new: true }
      );
      console.log('seller', seller);
      if (!seller) {
        return response.error(res, 'Seller not found');
      }

      if (seller.role === 'Seller' && Status.toLowerCase() === 'verified') {
        const existingWallet = await SellerWallet.findOne({
          sellerId: seller._id
        });

        if (!existingWallet) {
          await SellerWallet.create({
            sellerId: seller._id,
            balance: 0,
            transactions: []
          });
        }
      }

      return response.ok(res, seller);
    } catch (error) {
      return response.error(res, error);
    }
  }
};
