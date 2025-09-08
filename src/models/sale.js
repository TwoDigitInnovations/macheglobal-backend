'use strict';

const mongoose = require('mongoose');
const { object } = require('underscore');

const flashSaleSchema = new mongoose.Schema(
  {
    SellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    startDateTime: {
      type: Date,
      required: true
    },
    endDateTime: {
      type: Date,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    availableQty: {
      type: Number
    },
    offerPrice: {
      type: Number
    },
    originalPrice: {
      type: Number
    },
    attribute: {
      type: object
    },
    variant: {
      type: object
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
      default: 'ACTIVE'
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Add index for better performance
flashSaleSchema.index({ product: 1, status: 1 });
flashSaleSchema.index({ endDateTime: 1 });

flashSaleSchema.set('toJSON', {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('FlashSale', flashSaleSchema);
