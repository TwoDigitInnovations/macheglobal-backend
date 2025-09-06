'use strict';

const mongoose = require('mongoose');
const productchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    categoryName: {
      type: String
    },
    subCategoryName: {
      type: String
    },
    subcategory: {
      _id: mongoose.Schema.Types.ObjectId,
      name: String
    },
    slug: {
      type: String
    },
    brandName: {
      type: String
    },
    Brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand'
    },
    name: {
      type: String
    },
    gender: {
      type: String
    },
    image: {
      type: String
    },
    short_description: {
      type: String
    },
    long_description: {
      type: String
    },
    price: {
      type: Number
    },

    pieces: {
      type: Number
    },
    sold_pieces: {
      type: Number,
      default: 0
    },
    varients: {
      type: []
    },
    parameter_type: {
      type: String
    },
    Attribute: [],
    price_slot: []
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Product', productchema);
