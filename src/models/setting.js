'use strict';

const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    carousel: [
      {
        image: {
          type: String
        },
        Category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category'
        }
      }
    ],
    Address: {
      type: String
    },
    MobileNo: {
      type: String
    },
    ApiSecretKey: {
      type: String
    },
    ApiPrivateKey: {
      type: String
    },
    globalCommissionRate: {
      type: Number,
      default: 2, // Default 2% commission
      min: 0,
      max: 100
    }
  },
  {
    timestamps: true
  }
);

settingSchema.set('toJSON', {
  getters: true,
  virtuals: false,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Setting', settingSchema);
