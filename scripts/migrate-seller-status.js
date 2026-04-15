/**
 * Migration Script: Update old seller status values to new ones
 * 
 * Old values:
 * - verified → approved
 * - suspend → rejected
 * 
 * Run this script once to migrate all existing data:
 * node scripts/migrate-seller-status.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');

async function migrateSellers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Update verified → approved
    const verifiedResult = await User.updateMany(
      { role: 'Seller', status: 'verified' },
      { $set: { status: 'approved' } }
    );
    console.log(`✅ Updated ${verifiedResult.modifiedCount} sellers from 'verified' to 'approved'`);

    // Update suspend → rejected
    const suspendResult = await User.updateMany(
      { role: 'Seller', status: 'suspend' },
      { $set: { status: 'rejected' } }
    );
    console.log(`✅ Updated ${suspendResult.modifiedCount} sellers from 'suspend' to 'rejected'`);

    // Show final counts
    const pending = await User.countDocuments({ role: 'Seller', status: 'pending' });
    const approved = await User.countDocuments({ role: 'Seller', status: 'approved' });
    const rejected = await User.countDocuments({ role: 'Seller', status: 'rejected' });

    console.log('\n📊 Final Status Counts:');
    console.log(`   Pending: ${pending}`);
    console.log(`   Approved: ${approved}`);
    console.log(`   Rejected: ${rejected}`);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateSellers();
