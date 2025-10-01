'use strict';
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    user: {
      type: String,
      required: true
    },
    expiration_at: {
      type: Date,
      required: true
    },
    otp: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    phone: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

verificationSchema.set('toJSON', {
  getters: true,
  virtuals: false,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Verification', verificationSchema);
