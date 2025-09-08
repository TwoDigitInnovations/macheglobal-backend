const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
    {
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        sellerName: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        requestedAt: {
            type: Date,
            default: Date.now
        },
        processedAt: {
            type: Date
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        remarks: {
            type: String

        }, // rejection reason
        bankDetails: {
            accountNumber: String,
            ifscCode: String,
            bankName: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
