'use strict';

const mongoose = require('mongoose');
const { object } = require('underscore');

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point']
  },
  coordinates: {
    type: [Number]
  }
});

const productrequestchema = new mongoose.Schema(
  {
    productDetail: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        image: [
          {
            type: String
          }
        ],
        total: {
          type: Number
        },
        color: {
          type: String
        },
        size: {
          type: String
        },
        attribute: {
          type: object
        },
        qty: {
          type: Number
        },
        price: {
          type: Number
        }
      }
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: [
        'Pending',
        'Completed',
        'Return',
        'Cancel',
        'Shipped',
        'Return Requested'
      ],
      default: 'Pending'
    },
    orderId: {
      type: String,
      unique: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    seller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    total: {
      type: String
    },
    ShippingAddress: {
      type: Object
    },
    location: {
      type: pointSchema
    }
  },
  {
    timestamps: true
  }
);

productrequestchema.set('toJSON', {
  getters: true,
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  }
});
productrequestchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ProductRequest', productrequestchema);
