const mongoose = require("mongoose");

const adminWalletSchema = new mongoose.Schema(
    {
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

module.exports = mongoose.model("AdminWallet", adminWalletSchema);
