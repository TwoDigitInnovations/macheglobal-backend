const SellerWallet = require('../models/SellerWallet');
const AdminWallet = require('../models/AdminWallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/withdrawReq');
const response = require('../../responses');
const mongoose = require('mongoose')


module.exports = {
  getSellerWallet: async (req, res) => {
    try {
      const wallet = await SellerWallet.findOne({
        sellerId: req.params.sellerId
      })
        .populate('sellerId', 'name email')
        .populate('transactions');
      if (!wallet) return response.error(res, 'Seller wallet not found');
      return response.ok(res, wallet);
    } catch (error) {
      return response.error(res, error);
    }
  },

  creditSellerWallet: async (req, res) => {
    try {
      const { sellerId, amount, description } = req.body;
      const wallet = await SellerWallet.findOne({ sellerId });
      if (!wallet) return response.error(res, 'Seller wallet not found');

      wallet.balance += amount;
      const transaction = await WalletTransaction.create({
        walletType: 'seller',
        sellerId,
        type: 'credit',
        amount,
        description,
        sellerName: wallet?.sellerId?.name,
        status: 'completed'
      });
      wallet.transactions.push(transaction._id);
      await wallet.save();

      return response.ok(res, { wallet, transaction });
    } catch (error) {
      return response.error(res, error);
    }
  },

  debitSellerWallet: async (req, res) => {
    try {
      const { sellerId, amount, description } = req.body;
      const wallet = await SellerWallet.findOne({ sellerId });
      if (!wallet) return response.error(res, 'Seller wallet not found');

      if (wallet.balance < amount) {
        return response.error(res, 'Insufficient balance');
      }

      wallet.balance -= amount;
      const transaction = await WalletTransaction.create({
        walletType: 'seller',
        sellerId,
        type: 'debit',
        amount,
        description,
        sellerName: wallet?.sellerId?.name,
        status: 'completed'
      });
      wallet.transactions.push(transaction._id);
      await wallet.save();

      return response.ok(res, { wallet, transaction });
    } catch (error) {
      return response.error(res, error);
    }
  },

 

  getAdminWallet: async (req, res) => {
    try {
      const wallet = await AdminWallet.findOne({}).populate('transactions');
      if (!wallet) return response.error(res, 'Admin wallet not found');
      return response.ok(res, wallet);
    } catch (error) {
      return response.error(res, error);
    }
  },

  creditAdminWallet: async (req, res) => {
    try {
      const { amount, description } = req.body;
      const wallet = await AdminWallet.findOne({});
      if (!wallet) return response.error(res, 'Admin wallet not found');

      wallet.balance += amount;
      const transaction = await WalletTransaction.create({
        walletType: 'admin',
        type: 'credit',
        amount,
        description,
        status: 'completed'
      });
      wallet.transactions.push(transaction._id);
      await wallet.save();

      return response.ok(res, { wallet, transaction });
    } catch (error) {
      return response.error(res, error);
    }
  },

  debitAdminWallet: async (req, res) => {
    try {
      const { amount, description } = req.body;
      const wallet = await AdminWallet.findOne({});
      if (!wallet) return response.error(res, 'Admin wallet not found');

      if (wallet.balance < amount) {
        return response.error(res, 'Insufficient balance');
      }

      wallet.balance -= amount;
      const transaction = await WalletTransaction.create({
        walletType: 'admin',
        type: 'debit',
        amount,
        description,
        status: 'completed'
      });
      wallet.transactions.push(transaction._id);
      await wallet.save();

      return response.ok(res, { wallet, transaction });
    } catch (error) {
      return response.error(res, error);
    }
  },


  getAllTransactions: async (req, res) => {
    try {
      const { walletType, sellerId, status } = req.query;
      let query = {};
      if (walletType) query.walletType = walletType;
      if (sellerId) query.sellerId = sellerId;
      if (status) query.status = status;

      const transactions = await WalletTransaction.find(query).sort({
        createdAt: -1
      });
      return response.ok(res, transactions);
    } catch (error) {
      return response.error(res, error);
    }
  },



  requestWithdrawal: async (req, res) => {
    try {
      console.log('Withdrawal request received:', req.body);
      
      const { sellerId, sellerName, amount, paymentMethod, accountDetails = {} } = req.body;
      
      // Validate required fields
      if (!sellerId || !sellerName || amount === undefined) {
        console.error('Missing required fields:', { sellerId, sellerName, amount });
        return response.error(res, 'Missing required fields');
      }
      
      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        console.error('Invalid amount:', amount);
        return response.error(res, 'Invalid amount');
      }
      
      console.log('Looking up seller wallet for ID:', sellerId);
      const sellerWallet = await SellerWallet.findOne({ sellerId });
      
      if (!sellerWallet) {
        console.error('Seller wallet not found for ID:', sellerId);
        return response.error(res, 'Seller wallet not found');
      }

      console.log('Current wallet balance:', sellerWallet.balance, 'Requested amount:', amount);
      if (sellerWallet.balance < amount) {
        return response.error(res, `Insufficient balance. Available: ${sellerWallet.balance}`);
      }

      // Prepare withdrawal data
      const withdrawalData = {
        sellerId,
        sellerName,
        amount: parseFloat(amount),
        status: 'pending',
        bankDetails: {
          accountNumber: accountDetails.accountNumber || 'N/A',
          bankName: accountDetails.bankName || 'N/A',
          ifscCode: accountDetails.ifscCode || 'N/A',
          accountHolderName: accountDetails.accountHolderName || sellerName
        }
      };

      console.log('Creating withdrawal request with data:', withdrawalData);
      
      // Create withdrawal request
      const request = await WithdrawalRequest.create(withdrawalData);
      
      // Update seller's wallet balance
      sellerWallet.balance = parseFloat((sellerWallet.balance - amount).toFixed(2));
      sellerWallet.pendingWithdrawals = parseFloat(((sellerWallet.pendingWithdrawals || 0) + amount).toFixed(2));
      await sellerWallet.save();
      
      console.log('Withdrawal request created successfully:', request);

      return response.ok(res, request);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getSellerWithdrawals: async (req, res) => {
    try {
      const withdrawals = await WithdrawalRequest.find({
        sellerId: req.params.sellerId
      }).sort({ createdAt: -1 });
      return response.ok(res, withdrawals);
    } catch (error) {
      return response.error(res, error);
    }
  },

 

  getPendingWithdrawals: async (req, res) => {
    try {
      const withdrawals = await WithdrawalRequest.find({ status: 'pending' });
      return response.ok(res, withdrawals);
    } catch (error) {
      return response.error(res, error);
    }
  },

  approveWithdrawal: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log('approveWithdrawal called with params:', req.params);
      const { id: withdrawalId } = req.params;
      
      // Validate withdrawal ID
      if (!withdrawalId || !/^[0-9a-fA-F]{24}$/.test(withdrawalId)) {
        console.error('Invalid withdrawal ID format:', withdrawalId);
        return response.error(res, 'Invalid withdrawal ID format');
      }
      
      console.log('Finding withdrawal request with ID:', withdrawalId);
      const request = await WithdrawalRequest.findById(withdrawalId).session(session);
      if (!request) {
        console.error('Withdrawal request not found for ID:', withdrawalId);
        return response.error(res, 'Withdrawal request not found');
      }
      
      console.log('Found withdrawal request:', request);
      
      if (request.status !== 'pending') {
        console.log(`Withdrawal request is already ${request.status}`);
        return response.error(res, `Withdrawal request is already ${request.status}`);
      }

      console.log('Finding seller wallet for seller ID:', request.sellerId);
      const sellerWallet = await SellerWallet.findOne({
        sellerId: request.sellerId
      }).session(session);
      
      if (!sellerWallet) {
        console.error('Seller wallet not found for seller ID:', request.sellerId);
        return response.error(res, 'Seller wallet not found');
      }

      console.log('Checking seller balance. Current balance:', sellerWallet.balance, 'Requested amount:', request.amount);
      if (sellerWallet.balance < request.amount) {
        return response.error(res, 'Insufficient seller balance');
      }

      try {
        // 1. Debit seller's wallet
        console.log('Debiting seller wallet');
        sellerWallet.balance = parseFloat((sellerWallet.balance - request.amount).toFixed(2));
        await sellerWallet.save({ session });

        // 2. Create a transaction record
        const transaction = new WalletTransaction({
          walletType: 'Seller',  // Changed from 'seller' to 'Seller' to match enum
          sellerId: request.sellerId,
          type: 'debit',
          amount: request.amount,
          description: `Withdrawal to bank account (${request.bankDetails.accountNumber})`,
          status: 'completed',
          referenceId: withdrawalId,
          sellerName: request.sellerName
        });
        await transaction.save({ session });

        // 3. Update withdrawal request status
        console.log('Updating withdrawal request status to approved');
        request.status = 'approved';
        request.processedAt = new Date();
        await request.save({ session });

        // 4. Commit the transaction
        await session.commitTransaction();
        console.log('Withdrawal approved successfully');
        
        return response.ok(res, {
          message: 'Withdrawal approved successfully',
          withdrawal: request,
          newBalance: sellerWallet.balance
        });
      } catch (error) {
        // If anything fails, abort the transaction
        await session.abortTransaction();
        console.error('Error during withdrawal approval:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in approveWithdrawal:', error);
      // Send detailed error to client in development
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Failed to approve withdrawal';
      return response.error(res, errorMessage);
    }
  },

  rejectWithdrawal: async (req, res) => {
    try {
      const { id: withdrawalId } = req.params;
      const { remarks } = req.body;
      const request = await WithdrawalRequest.findById(withdrawalId);
      if (!request) return response.error(res, 'Request not found');
      
      if (request.status !== 'pending') {
        return response.error(res, `Withdrawal request is already ${request.status}`);
      }

      request.status = 'rejected';
      request.processedAt = Date.now();
      request.remarks = remarks || 'Rejected by admin';
      await request.save();

      return response.ok(res, request);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getAllWithdrawals: async (req, res) => {
    try {
      const withdrawals = await WithdrawalRequest.find({}).sort({
        createdAt: -1
      });
      return response.ok(res, withdrawals);
    } catch (error) {
      return response.error(res, error);
    }
  },

  // Get user transactions
  getUserTransactions: async (req, res) => {
    try {
      const userId = req.user.id;
      const transactions = await WalletTransaction.find({
        $or: [
          { sellerId: userId },
          { adminId: userId }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(50);

      return response.ok(res, { transactions });
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      return response.error(res, 'Error fetching transactions');
    }
  },

  // ----------------- DASHBOARD STATS -----------------

  getSellerStats: async (req, res) => {
    try {
      const { sellerId } = req.params;
      const wallet = await SellerWallet.findOne({ sellerId });
      const totalEarnings = await WalletTransaction.aggregate([
        {
          $match: {
            sellerId: wallet.sellerId,
            type: 'credit',
            walletType: 'seller'
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const thisMonthEarnings = await WalletTransaction.aggregate([
        {
          $match: {
            sellerId: wallet.sellerId,
            type: 'credit',
            walletType: 'seller',
            createdAt: { $gte: new Date(new Date().setDate(1)) }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const pendingWithdrawals = await WithdrawalRequest.countDocuments({
        sellerId,
        status: 'pending'
      });

      return response.ok(res, {
        balance: wallet.balance,
        totalEarnings: totalEarnings[0]?.total || 0,
        pendingWithdrawals,
        thisMonthEarnings: thisMonthEarnings[0]?.total || 0
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getAdminStats: async (req, res) => {
    try {
      const wallet = await AdminWallet.findOne({});
      const totalCommission = await WalletTransaction.aggregate([
        { $match: { walletType: 'admin', type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalPayouts = await WithdrawalRequest.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const pendingCount = await WithdrawalRequest.countDocuments({
        status: 'pending'
      });
      const activeSellers = await SellerWallet.countDocuments({
        balance: { $gt: 0 }
      });

      return response.ok(res, {
        balance: wallet.balance,
        totalCommission: totalCommission[0]?.total || 0,
        totalPayouts: totalPayouts[0]?.total || 0,
        pendingCount,
        activeSellers
      });
    } catch (error) {
      return response.error(res, error);
    }
  }
};
