const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, required: true },
  name: { type: String, required: true }
}, { _id: false });

const sellerStoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeName: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true
  },
  ownerName: {
    type: String,
    required: [true, 'Owner name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    trim: true
  },
  logo: {
    url: { type: String, required: [true, 'Store logo is required'] },
    publicId: { type: String }
  },
  documents: [documentSchema],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
sellerStoreSchema.index({ userId: 1 });
sellerStoreSchema.index({ email: 1 }, { unique: true });
sellerStoreSchema.index({ phone: 1 }, { unique: true });


sellerStoreSchema.virtual('storeUrl').get(function() {
  return `/sellers/${this._id}`;
});


const SellerStore = mongoose.model('SellerStore', sellerStoreSchema);

module.exports = SellerStore;
