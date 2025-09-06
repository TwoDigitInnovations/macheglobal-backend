'use strict';

const mongoose = require('mongoose');
const reviewSchema = new mongoose.Schema(
  {
    description: {
      type: String
    },
    posted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    rating: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Review', reviewSchema);
