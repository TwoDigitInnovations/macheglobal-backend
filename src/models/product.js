'use strict';

const mongoose = require('mongoose');

// Variant Schema - For products with multiple options (color, size, etc.)
const variantSchema = new mongoose.Schema({
  // Variant Attributes (e.g., Color: Red, Size: M)
  attributes: [{
    name: { type: String, required: true },  // e.g., "Color", "Size"
    value: { type: String, required: true }  // e.g., "Red", "M"
  }],
  
  // Variant-specific details
  sku: { type: String },  // Unique SKU for this variant
  images: [{ type: String }],  // Images specific to this variant
  
  // Pricing
  price: { type: Number, required: true },
  offerPrice: { type: Number },
  
  // Stock
  stock: { type: Number, required: true, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true }
}, { _id: true });

// Main Product Schema
const productSchema = new mongoose.Schema(
  {
    // Basic Info
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      unique: true,
      sparse: true
    },
    
    // Category Info
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    categoryName: { type: String },
    
    subcategory: {
      _id: mongoose.Schema.Types.ObjectId,
      name: String
    },
    subCategoryName: { type: String },
    
    // Seller Info
    SellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    
    // Brand Info
    Brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand'
    },
    brandName: { type: String },
    
    // Product Type
    is_manufacturer_product: {
      type: Boolean,
      default: false
    },
    
    // Product Details
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Unisex', '']
    },
    short_description: { type: String },
    long_description: { type: String },
    
    // Product Type: Simple or Variable
    productType: {
      type: String,
      enum: ['simple', 'variable'],
      default: 'simple',
      required: true
    },
    
    // For Simple Products (No Variants)
    simpleProduct: {
      price: { type: Number },
      offerPrice: { type: Number },
      stock: { type: Number, default: 0 },
      sku: { type: String },
      images: [{ type: String }]
    },
    
    // For Variable Products (With Variants)
    variants: [variantSchema],
    
    // Available variant options (e.g., ["Color", "Size"])
    variantOptions: [{
      name: { type: String },  // e.g., "Color"
      values: [{ type: String }]  // e.g., ["Red", "Blue", "Green"]
    }],
    
    // Legacy fields (for backward compatibility)
    image: { type: String },
    price: { type: Number },
    pieces: { type: Number },
    sold_pieces: { type: Number, default: 0 },
    varients: { type: [] },  // Old structure
    parameter_type: { type: String },
    Attribute: [],
    price_slot: [],
    
    // Soft Delete
    isDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// Indexes for better performance
productSchema.index({ slug: 1 });
productSchema.index({ SellerId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ productType: 1 });

// Virtual for total stock
productSchema.virtual('totalStock').get(function() {
  if (this.productType === 'simple') {
    return this.simpleProduct?.stock || 0;
  } else {
    return this.variants?.reduce((total, variant) => total + (variant.stock || 0), 0) || 0;
  }
});

// Method to check if product is in stock
productSchema.methods.isInStock = function() {
  if (this.productType === 'simple') {
    return (this.simpleProduct?.stock || 0) > 0;
  } else {
    return this.variants?.some(v => v.stock > 0) || false;
  }
};

module.exports = mongoose.model('Product', productSchema);
