const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'Account is required'],
        index: true,
        immutable: true
    },
    amount:{
        type: Number,
        required: [true, 'Amount is required'],
        immutable: true,
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'transaction',
        required: [true, 'Transaction is required'],
        index: true,
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: ['debit', 'credit'],
            message: 'Invalid ledger type'
        },
        required: [true, 'Ledger type is required'],
        immutable: true,
    }
})


function preventLedgerUpdate() {
   throw new Error('Ledger entries cannot be updated');
}

ledgerSchema.pre('findOneAndUpdate', preventLedgerUpdate);
ledgerSchema.pre('findOneAndDelete', preventLedgerUpdate);
ledgerSchema.pre('findOneAndReplace', preventLedgerUpdate);
ledgerSchema.pre('updateOne', preventLedgerUpdate);
ledgerSchema.pre('updateMany', preventLedgerUpdate);
ledgerSchema.pre('deleteOne', preventLedgerUpdate);
ledgerSchema.pre('deleteMany', preventLedgerUpdate);
ledgerSchema.pre('update', preventLedgerUpdate);
ledgerSchema.pre('remove', preventLedgerUpdate);


const ledgerModel = mongoose.model('ledger', ledgerSchema);

module.exports = ledgerModel;
