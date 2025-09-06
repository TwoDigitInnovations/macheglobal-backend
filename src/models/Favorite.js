'use strict';

const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Favourite', favouriteSchema);
