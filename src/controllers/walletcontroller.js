const SellerWallet = require("../models/SellerWallet");
const AdminWallet = require("../models/AdminWallet");
const WalletTransaction = require("../models/WalletTransaction");
const WithdrawalRequest = require("../models/withdrawReq");
const response = require('../../responses');

// ----------------- SELLER WALLET -----------------
module.exports = {
  getSellerWallet: async (req, res) => {
    try {
      const wallet = await SellerWallet.findOne({ sellerId: req.params.sellerId })
        .populate("sellerId", "name email")
        .populate("transactions");
      if (!wallet) return response.error(res, "Seller wallet not found");
      return response.ok(res, wallet);
    } catch (error) {
      return response.error(res, error);
    }
  },


  creditSellerWallet: async (req, res) => {
    try {
      const { sellerId, amount, description } = req.body;
      const wallet = await SellerWallet.findOne({ sellerId });
      if (!wallet) return response.error(res, "Seller wallet not found");

      wallet.balance += amount;
      const transaction = await WalletTransaction.create({
        walletType: "seller",
        sellerId,
        type: "credit",
        amount,
        description,
        sellerName: wallet?.sellerId?.name,
        status: "completed",
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
      if (!wallet) return response.error(res, "Seller wallet not found");

      if (wallet.balance < amount) {
        return response.error(res, "Insufficient balance");
      }

      wallet.balance -= amount;
      const transaction = await WalletTransaction.create({
        walletType: "seller",
        sellerId,
        type: "debit",
        amount,
        description,
        sellerName: wallet?.sellerId?.name,
        status: "completed",
      });
      wallet.transactions.push(transaction._id);
      await wallet.save();

      return response.ok(res, { wallet, transaction });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // ----------------- ADMIN WALLET -----------------

  getAdminWallet: async (req, res) => {
    try {
      const wallet = await AdminWallet.findOne({})
        .populate("transactions");
      if (!wallet) return response.error(res, "Admin wallet not found");
      return response.ok(res, wallet);
    } catch (error) {
      return response.error(res, error);
    }
  },

  creditAdminWallet: async (req, res) => {
    try {
      const { amount, description } = req.body;
      const wallet = await AdminWallet.findOne({});
      if (!wallet) return response.error(res, "Admin wallet not found");

      wallet.balance += amount;
      const transaction = await WalletTransaction.create({
        walletType: "admin",
        type: "credit",
        amount,
        description,
        status: "completed",
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
      if (!wallet) return response.error(res, "Admin wallet not found");

      if (wallet.balance < amount) {
        return response.error(res, "Insufficient balance");
      }

      wallet.balance -= amount;
      const transaction = await WalletTransaction.create({
        walletType: "admin",
        type: "debit",
        amount,
        description,
        status: "completed",
      });
      wallet.transactions.push(transaction._id);
      await wallet.save();

      return response.ok(res, { wallet, transaction });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // ----------------- TRANSACTIONS -----------------

  getAllTransactions: async (req, res) => {
    try {
      const { walletType, sellerId, status } = req.query;
      let query = {};
      if (walletType) query.walletType = walletType;
      if (sellerId) query.sellerId = sellerId;
      if (status) query.status = status;

      const transactions = await WalletTransaction.find(query).sort({ createdAt: -1 });
      return response.ok(res, transactions);
    } catch (error) {
      return response.error(res, error);
    }
  },

  // ----------------- WITHDRAWALS (SELLER) -----------------

  requestWithdrawal: async (req, res) => {
    try {
      const { sellerId, amount, bankDetails } = req.body;
      const sellerWallet = await SellerWallet.findOne({ sellerId });
      if (!sellerWallet) return response.error(res, "Seller wallet not found");

      if (sellerWallet.balance < amount) {
        return response.error(res, "Insufficient balance");
      }

      const request = await WithdrawalRequest.create({
        sellerId,
        sellerName: sellerWallet?.sellerId?.name,
        amount,
        bankDetails,
        status: "pending",
      });

      return response.ok(res, request);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getSellerWithdrawals: async (req, res) => {
    try {
      const withdrawals = await WithdrawalRequest.find({ sellerId: req.params.sellerId })
        .sort({ createdAt: -1 });
      return response.ok(res, withdrawals);
    } catch (error) {
      return response.error(res, error);
    }
  },

  // ----------------- WITHDRAWALS (ADMIN) -----------------

  getPendingWithdrawals: async (req, res) => {
    try {
      const withdrawals = await WithdrawalRequest.find({ status: "pending" });
      return response.ok(res, withdrawals);
    } catch (error) {
      return response.error(res, error);
    }
  },

  approveWithdrawal: async (req, res) => {
    try {
      const { withdrawalId, adminId } = req.body;
      const request = await WithdrawalRequest.findById(withdrawalId);
      if (!request) return response.error(res, "Request not found");

      const sellerWallet = await SellerWallet.findOne({ sellerId: request.sellerId });
      const adminWallet = await AdminWallet.findOne({});

      if (sellerWallet.balance < request.amount) {
        return response.error(res, "Insufficient seller balance");
      }

      // Debit seller wallet
      sellerWallet.balance -= request.amount;
      await sellerWallet.save();

      // Debit admin wallet (payout)
      if (adminWallet.balance < request.amount) {
        return response.error(res, "Insufficient admin balance");
      }
      adminWallet.balance -= request.amount;
      await adminWallet.save();

      request.status = "approved";
      request.processedAt = Date.now();
      request.processedBy = adminId;
      await request.save();

      return response.ok(res, request);
    } catch (error) {
      return response.error(res, error);
    }
  },

  rejectWithdrawal: async (req, res) => {
    try {
      const { withdrawalId, remarks, adminId } = req.body;
      const request = await WithdrawalRequest.findById(withdrawalId);
      if (!request) return response.error(res, "Request not found");

      request.status = "rejected";
      request.processedAt = Date.now();
      request.processedBy = adminId;
      request.remarks = remarks;
      await request.save();

      return response.ok(res, request);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getAllWithdrawals: async (req, res) => {
    try {
      const withdrawals = await WithdrawalRequest.find({}).sort({ createdAt: -1 });
      return response.ok(res, withdrawals);
    } catch (error) {
      return response.error(res, error);
    }
  },

  // ----------------- DASHBOARD STATS -----------------

  getSellerStats: async (req, res) => {
    try {
      const { sellerId } = req.params;
      const wallet = await SellerWallet.findOne({ sellerId });
      const totalEarnings = await WalletTransaction.aggregate([
        { $match: { sellerId: wallet.sellerId, type: "credit", walletType: "seller" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const thisMonthEarnings = await WalletTransaction.aggregate([
        {
          $match: {
            sellerId: wallet.sellerId,
            type: "credit",
            walletType: "seller",
            createdAt: { $gte: new Date(new Date().setDate(1)) },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const pendingWithdrawals = await WithdrawalRequest.countDocuments({
        sellerId,
        status: "pending",
      });

      return response.ok(res, {
        balance: wallet.balance,
        totalEarnings: totalEarnings[0]?.total || 0,
        pendingWithdrawals,
        thisMonthEarnings: thisMonthEarnings[0]?.total || 0,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getAdminStats: async (req, res) => {
    try {
      const wallet = await AdminWallet.findOne({});
      const totalCommission = await WalletTransaction.aggregate([
        { $match: { walletType: "admin", type: "credit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const totalPayouts = await WithdrawalRequest.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const pendingCount = await WithdrawalRequest.countDocuments({ status: "pending" });
      const activeSellers = await SellerWallet.countDocuments({ balance: { $gt: 0 } });

      return response.ok(res, {
        balance: wallet.balance,
        totalCommission: totalCommission[0]?.total || 0,
        totalPayouts: totalPayouts[0]?.total || 0,
        pendingCount,
        activeSellers,
      });
    } catch (error) {
      return response.error(res, error);
    }
  },
};
