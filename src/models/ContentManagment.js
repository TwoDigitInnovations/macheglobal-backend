'use strict';

const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  policy: {
    type: String
  }
});

module.exports = mongoose.model('Content', contentSchema);
