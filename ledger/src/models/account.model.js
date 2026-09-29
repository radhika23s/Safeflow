const mongoose = require('mongoose');
const ledgerModel = require('./ledger.model');

const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: [true, 'User is required'],
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'frozen', 'closed'],
            message: 'Invalid account status',
        },
        default: 'active'
    },
    currency: {
        type: String,
        required: [true, 'Currency is required']
        , default: 'INR'
    },

}, {
    timestamps: true
});


accountSchema.index({ user: 1, status: 1 });

accountSchema.methods.getbalance = async function () {
    const balancedata = await ledgerModel.aggregate([
        { $match: { account: this._id } },
        {
            $group: {
                _id: null,
                totalDebit: {
                    $sum: {
                        $cond: [
                            { $eq: ['$type', 'debit'] },
                            '$amount', 0
                        ]
                    }
                },
                totalCredit: {
                    $sum: {
                        $cond: [
                            { $eq: ['$type', 'credit'] },
                            '$amount', 0
                        ]
                    }
                }

            },
        },
        {
            $project: {
                _id: 0,
                balance: { $subtract: ['$totalCredit', '$totalDebit'] }
            }
        }
    ]);

    if(balancedata.length === 0) {
        return 0;
    }

    return balancedata[0].balance;

}



const accModel = mongoose.model('account', accountSchema);

module.exports = accModel;