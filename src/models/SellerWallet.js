const mongoose = require("mongoose");

const sellerWalletSchema = new mongoose.Schema(
    {
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        balance: {
            type: Number,
            default: 0
        },
        transactions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "WalletTransaction"
        }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("SellerWallet", sellerWalletSchema);
