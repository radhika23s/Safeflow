const transactionModel = require('../models/transaction.model');
const ledgerModel = require('../models/ledger.model');
const emailService = require('../services/email.service');
const accountModel = require('../models/account.model');
const mongoose = require('mongoose');
const axios = require('axios');


// ─── Fraud Engine Webhook ────────────────────────────────────────────────────
// Fire-and-forget: NEVER let a fraud engine failure block or rollback a transfer.
// The ledger's job is to move money correctly; compliance is a separate concern.

const FRAUD_ENGINE_URL = process.env.FRAUD_ENGINE_URL || 'http://localhost:8000';

async function notifyFraudEngine(transaction, fromAccountId, toAccountId, senderBefore = 0, senderAfter = 0, receiverBefore = 0, receiverAfter = 0) {
    try {
        const payload = {
            transaction_id: transaction._id.toString(),
            sender_account_id: fromAccountId.toString(),
            receiver_account_id: toAccountId.toString(),
            amount: transaction.amount,
            currency: 'INR',
            channel: transaction.channel || 'IMPS',
            timestamp: (transaction.createdAt || new Date()).toISOString(),
            idempotency_key: transaction.idempotencyKey,
            sender_balance_before: senderBefore,
            sender_balance_after: senderAfter,
            receiver_balance_before: receiverBefore,
            receiver_balance_after: receiverAfter,
        };

        const response = await axios.post(
            `${FRAUD_ENGINE_URL}/api/ingest-transaction`,
            payload,
            { timeout: 5000 }
        );

        const data = response.data;
        if (data.status === 'case_created') {
            console.log(`[FRAUD ENGINE] Case created: ${data.case_id} | Risk: ${data.risk_score} | Txn: ${transaction._id}`);
        } else {
            console.log(`[FRAUD ENGINE] ${data.status} | Score: ${data.risk_score ?? 'N/A'} | Txn: ${transaction._id}`);
        }
    } catch (err) {
        // Log but never throw — this must not break the transfer
        console.error(`[FRAUD ENGINE] Webhook failed for ${transaction._id}: ${err.message}`);
    }
}


async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: 'Missing required fields'
        });
    }

    const fromuseraccount = await accountModel.findById(fromAccount);
    const touseraccount = await accountModel.findById(toAccount);

    if (!fromuseraccount || !touseraccount) {
        return res.status(404).json({
            message: 'Account not found'
        });
    }

    const istransactionexist = await transactionModel.findOne({
        idempotencyKey
    });

    if (istransactionexist) {

        switch (istransactionexist.status) {

            case 'completed':
                return res.status(400).json({
                    message: 'Transaction already completed',
                    transaction: istransactionexist
                });

            case 'pending':
                return res.status(400).json({
                    message: 'Transaction is pending'
                });

            case 'failed':
                return res.status(400).json({
                    message: 'Transaction failed'
                });

            case 'reversed':
                return res.status(400).json({
                    message: 'Transaction reversed'
                });
        }
    }

    if (
        fromuseraccount.status !== 'active' ||
        touseraccount.status !== 'active'
    ) {
        return res.status(400).json({
            message: 'Account is not active'
        });
    }

    const balance = await fromuseraccount.getbalance();

    if (balance < amount) {
        return res.status(400).json({
            message: 'Insufficient balance'
        });
    }

    const toBalance = await touseraccount.getbalance();

    let session;
    let transaction;

    try {

        session = await mongoose.startSession();
        session.startTransaction();

        transaction = (
            await transactionModel.create([{
                fromAccount,
                toAccount,
                amount,
                idempotencyKey,
                status: 'pending'
            }], { session })
        )[0];

        await ledgerModel.create([{
            account: fromAccount,
            type: 'debit',
            amount,
            transaction: transaction._id
        }], { session });

        await ledgerModel.create([{
            account: toAccount,
            type: 'credit',
            amount,
            transaction: transaction._id
        }], { session });

        await transactionModel.findByIdAndUpdate(
            transaction._id,
            {
                status: 'completed'
            },
            { session }
        );

        await session.commitTransaction();

        // ─── Notify fraud engine AFTER successful commit (fire-and-forget) ───
        notifyFraudEngine(
            transaction,
            fromAccount,
            toAccount,
            balance,
            balance - amount,
            toBalance,
            toBalance + amount
        );

    } catch (err) {

        if (session) {
            await session.abortTransaction();
        }

        console.error(err);

        if (err.code === 11000) {
            return res.status(409).json({
                message:
                    'Transaction already exists with this idempotency key'
            });
        }

        return res.status(500).json({
            message: 'Transaction failed'
        });

    } finally {

        if (session) {
            await session.endSession();
        }
    }

    try {

        await emailService.sendTransactionEmail(
            req.user.email,
            req.user.name,
            amount,
            toAccount
        );

    } catch (emailError) {

        console.error(
            'Email sending failed:',
            emailError
        );

    }

    return res.status(201).json({
        message: 'Transaction completed',
        transaction
    });
}

async function initiateSystemTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const touseraccount = await accountModel.findOne({
        _id: toAccount
    });

    if (!touseraccount) {
        return res.status(404).json({ message: 'Account not found' });
    }

    
    const fromUserAccount = await accountModel.findOne({
        user: req.user._id,
    });
    
    console.log("ACCOUNT:", fromUserAccount);
    
    if (!fromUserAccount) {
        return res.status(404).json({ message: 'System account not found' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const newTransaction = await transactionModel.create([{
        fromAccount: fromUserAccount._id,
        toAccount: touseraccount._id,
        amount: amount,
        idempotencyKey: idempotencyKey,
        status: 'pending'
    }], { session });

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        type: 'debit',
        amount: amount,
        transaction: newTransaction[0]._id
    }], { session });

   
    const creditLedgerEntry = await ledgerModel.create([{
        account: touseraccount._id,
        type: 'credit',
        amount: amount,
        transaction: newTransaction[0]._id
    }], { session });

    newTransaction[0].status = 'completed';

    await newTransaction[0].save({ session });
    await session.commitTransaction();
    session.endSession();

    // ─── Notify fraud engine AFTER successful commit (fire-and-forget) ───
    notifyFraudEngine(newTransaction[0], fromUserAccount._id, touseraccount._id);

    return res.status(201).json({ message: 'System transaction completed', transaction: newTransaction });

}




module.exports = {
    createTransaction,
    initiateSystemTransaction
}







async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: 'Missing required fields'
        });
    }

    const fromuseraccount = await accountModel.findById(fromAccount);
    const touseraccount = await accountModel.findById(toAccount);

    if (!fromuseraccount || !touseraccount) {
        return res.status(404).json({
            message: 'Account not found'
        });
    }

    const istransactionexist = await transactionModel.findOne({
        idempotencyKey
    });

    if (istransactionexist) {

        switch (istransactionexist.status) {

            case 'completed':
                return res.status(400).json({
                    message: 'Transaction already completed',
                    transaction: istransactionexist
                });

            case 'pending':
                return res.status(400).json({
                    message: 'Transaction is pending'
                });

            case 'failed':
                return res.status(400).json({
                    message: 'Transaction failed'
                });

            case 'reversed':
                return res.status(400).json({
                    message: 'Transaction reversed'
                });
        }
    }

    if (
        fromuseraccount.status !== 'active' ||
        touseraccount.status !== 'active'
    ) {
        return res.status(400).json({
            message: 'Account is not active'
        });
    }

    const balance = await fromuseraccount.getbalance();

    if (balance < amount) {
        return res.status(400).json({
            message: 'Insufficient balance'
        });
    }

    let session;
    let transaction;

    try {

        session = await mongoose.startSession();
        session.startTransaction();

        transaction = (
            await transactionModel.create([{
                fromAccount,
                toAccount,
                amount,
                idempotencyKey,
                status: 'pending'
            }], { session })
        )[0];

        await ledgerModel.create([{
            account: fromAccount,
            type: 'debit',
            amount,
            transaction: transaction._id
        }], { session });

        // Simulate delay
        await new Promise(resolve =>
            setTimeout(resolve, 10000)
        );

        await ledgerModel.create([{
            account: toAccount,
            type: 'credit',
            amount,
            transaction: transaction._id
        }], { session });

        await transactionModel.findByIdAndUpdate(
            transaction._id,
            {
                status: 'completed'
            },
            { session }
        );

        await session.commitTransaction();

    } catch (err) {

        if (session) {
            await session.abortTransaction();
        }

        console.error(err);

        if (err.code === 11000) {
            return res.status(409).json({
                message:
                    'Transaction already exists with this idempotency key'
            });
        }

        return res.status(500).json({
            message: 'Transaction failed'
        });

    } finally {

        if (session) {
            await session.endSession();
        }
    }

    try {

        await emailService.sendTransactionEmail(
            req.user.email,
            req.user.name,
            amount,
            toAccount
        );

    } catch (emailError) {

        console.error(
            'Email sending failed:',
            emailError
        );

    }

    return res.status(201).json({
        message: 'Transaction completed',
        transaction
    });
}

async function initiateSystemTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const touseraccount = await accountModel.findOne({
        _id: toAccount
    });

    if (!touseraccount) {
        return res.status(404).json({ message: 'Account not found' });
    }

    
    const fromUserAccount = await accountModel.findOne({
        user: req.user._id,
    });
    
    console.log("ACCOUNT:", fromUserAccount);
    
    if (!fromUserAccount) {
        return res.status(404).json({ message: 'System account not found' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const newTransaction = await transactionModel.create([{
        fromAccount: fromUserAccount._id,
        toAccount: touseraccount._id,
        amount: amount,
        idempotencyKey: idempotencyKey,
        status: 'pending'
    }], { session });

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        type: 'debit',
        amount: amount,
        transaction: newTransaction[0]._id
    }], { session });

   
    const creditLedgerEntry = await ledgerModel.create([{
        account: touseraccount._id,
        type: 'credit',
        amount: amount,
        transaction: newTransaction[0]._id
    }], { session });

    newTransaction[0].status = 'completed';

    await newTransaction[0].save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ message: 'System transaction completed', transaction: newTransaction });

}




module.exports = {
    createTransaction,
    initiateSystemTransaction
}


