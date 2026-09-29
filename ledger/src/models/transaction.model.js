const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({

    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'From account is required'],
        index: true
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'To account is required'],
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'completed', 'failed','reversed'],
            message: 'Invalid transaction status'
        },
        default: 'pending'
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be at least 0.01']
    },
    idempotencyKey: {
        type: String,
        required: [true, 'Idempotency key is required'],
        index: true,
        unique: true
    }
},{
    timestamps: true

});

const transactionModel = mongoose.model('transaction', transactionSchema);

module.exports = transactionModel;