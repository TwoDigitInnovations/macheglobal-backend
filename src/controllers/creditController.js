const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const ErrorResponse = require('../utils/errorResponse');

// Get user credit balance
exports.getCreditBalance = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('creditBalance');
        
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                creditBalance: user.creditBalance || 0
            }
        });
    } catch (error) {
        console.error('Error getting credit balance:', error);
        next(error);
    }
};

// Get credit transaction history
exports.getCreditTransactions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const total = await CreditTransaction.countDocuments({ user: req.user.id });
        
        const transactions = await CreditTransaction.find({ user: req.user.id })
            .populate('order', 'orderId totalPrice')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            count: transactions.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: transactions
        });
    } catch (error) {
        console.error('Error getting credit transactions:', error);
        next(error);
    }
};

module.exports = exports;
