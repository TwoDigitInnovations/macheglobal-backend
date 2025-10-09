'use strict';

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true
    },
    posted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    images: [{
      type: String,
      trim: true
    }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
reviewSchema.index({ product: 1, posted_by: 1 });
reviewSchema.index({ order: 1, product: 1 });

// Prevent duplicate reviews for the same product from the same user in the same order
reviewSchema.index(
  { order: 1, product: 1, posted_by: 1 },
  { unique: true, message: 'You have already reviewed this product for this order' }
);

module.exports = mongoose.model('Review', reviewSchema);
