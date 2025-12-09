const mongoose = require('mongoose');
const Review = require('../models/Review')
const Order = require('../models/Order')
const Product = require('../models/product')
const { uploadToCloudinary } = require('../helper/cloudinary');
const { validationResult } = require('express-validator');


exports.createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, productId, rating, description, images = [] } = req.body;
    const userId = req.user?.id || req.user?._id; 
    
    if (!userId) {
      console.error('No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        debug: {
          user: req.user,
          headers: req.headers
        }
      });
    }

 
    
  
    let order = await Order.findOne({
      orderId: orderId,
      user: userId
    });
    
   
    if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findOne({
        _id: orderId,
        user: userId
      });
    }

    
    if (!order) {
   
      const anyOrder = await Order.findById(orderId);
      
      
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        debug: {
          orderId,
          userId,
          orderExists: !!anyOrder,
          orderUser: anyOrder?.user?.toString()
        }
      });
    }

   
    const productInOrder = order.orderItems.some(
      item => item.product.toString() === productId
    );

    if (!productInOrder) {
      return res.status(400).json({
        success: false,
        message: 'Product not found in the specified order'
      });
    }

    
    const existingReview = await Review.findOne({
      order: orderId,
      product: productId,
      posted_by: userId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product for this order'
      });
    }

 
    let uploadedImages = [];
    if (images && images.length > 0) {
      try {
        // Process each image - if it's already a URL, use it directly
        const uploadPromises = images.map(async (image) => {
          // Check if image is already a Cloudinary URL (starts with http/https)
          if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
            console.log('Image already uploaded to Cloudinary:', image);
            return image; // Return the URL directly
          }
          
          // Otherwise, upload the file
          console.log('Uploading new image to Cloudinary');
          const result = await uploadToCloudinary(image, 'reviews');
          return result.url || result.secure_url;
        });
        uploadedImages = await Promise.all(uploadPromises);
        console.log('Final uploaded images:', uploadedImages);
      } catch (uploadError) {
        console.error('Error uploading images:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading review images',
          error: uploadError.message
        });
      }
    }

   
    const review = new Review({
      description,
      rating,
      product: productId,
      order: orderId,
      posted_by: userId,
      images: uploadedImages,
      status: 'approved' 
    });

    await review.save();

   
    await updateProductRating(productId);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating review',
      error: error.message
    });
  }
};


exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ 
      product: productId,
      status: 'approved' 
    })
    .populate('posted_by', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const count = await Review.countDocuments({ 
      product: productId,
      status: 'approved' 
    });

    res.json({
      success: true,
      data: reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reviews',
      error: error.message
    });
  }
};


exports.getMyReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const reviews = await Review.find({ 
      posted_by: req.user._id 
    })
    .populate('product', 'name images')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const count = await Review.countDocuments({ 
      posted_by: req.user._id 
    });

    res.json({
      success: true,
      data: reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your reviews',
      error: error.message
    });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const query = { status: 'approved' };
    
    // Add search functionality if search term is provided
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { 'posted_by.name': { $regex: search, $options: 'i' } },
        { 'product.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add date filter if provided
    if (req.query.date) {
      const startOfDay = new Date(req.query.date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(req.query.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    const reviews = await Review.find(query)
      .populate('posted_by', 'name email')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalItems: count
    });
  } catch (error) {
    console.error('Error fetching all reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reviews',
      error: error.message
    });
  }
};

async function updateProductRating(productId) {
  try {
    const result = await Review.aggregate([
      { $match: { product: productId, status: 'approved' } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    if (result.length > 0) {
      const { averageRating, reviewCount } = result[0];
      await Product.findByIdAndUpdate(productId, {
        rating: parseFloat(averageRating.toFixed(1)),
        numReviews: reviewCount
      });
    }
  } catch (error) {
    console.error('Error updating product rating:', error);
    throw error;
  }
}
