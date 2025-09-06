'use strict';

const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String
    },
    slug: {
      type: String
    },
    Attribute: [],
    Subcategory: [
      {
        name: { type: String },
        Attribute: []
      }
    ],
    notAvailableSubCategory: {
      type: Boolean
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', categorySchema);
