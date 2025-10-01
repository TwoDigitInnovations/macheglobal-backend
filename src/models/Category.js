'use strict';

const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    slug: {
      type: String
    },
    image: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    Attribute: [],
    Subcategory: [
      {
        name: { 
          type: String, 
          required: true 
        },
        image: {
          public_id: {
            type: String,
          },
          url: {
            type: String,
          },
        },
        Attribute: []
      }
    ],
    notAvailableSubCategory: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', categorySchema);
