const accModel = require('../models/account.model');


async function createAccount(req, res) {

    const user = req.user;
    const account = await accModel.create({
    user: user._id,
});

return res.status(201).json({ message: 'Account created successfully', account });

}


async function getAccounts(req, res) {

    const user = req.user;
    const accounts = await accModel.find({ user: user._id });

    return res.status(200).json({ message: 'Accounts retrieved successfully', accounts });

}


async function getBalance(req, res) {

    const { accountId } = req.params;

    const account= await accModel.findOne({ _id: accountId, user: req.user._id });

    if (!account) {
        return res.status(404).json({ message: 'Account not found' });
    }

    const bal= await account.getbalance();

    return res.status(200).json({ message: 'Balance retrieved successfully', balance: bal });

}

async function deposit(req, res) {
    const { accountId, amount } = req.body;
    if (!accountId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: 'Valid accountId and positive amount are required' });
    }

    const account = await accModel.findOne({ _id: accountId, user: req.user._id });
    if (!account) {
        return res.status(404).json({ message: 'Account not found for current user' });
    }

    const transactionModel = require('../models/transaction.model');
    const ledgerModel = require('../models/ledger.model');
    const crypto = require('crypto');

    const fundTxn = await transactionModel.create({
        fromAccount: account._id,
        toAccount: account._id,
        amount: Number(amount),
        idempotencyKey: `DEPOSIT-${crypto.randomUUID()}`,
        status: 'completed',
    });

    await ledgerModel.create({
        account: account._id,
        type: 'credit',
        amount: Number(amount),
        transaction: fundTxn._id,
    });

    const newBalance = await account.getbalance();
    return res.status(200).json({
        message: 'Deposit successful',
        accountId: account._id,
        deposited: Number(amount),
        balance: newBalance,
    });
}

module.exports = {
    createAccount,
    getAccounts,
    getBalance,
    deposit,
}