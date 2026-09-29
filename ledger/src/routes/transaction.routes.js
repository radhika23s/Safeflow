const express = require('express');
const authmiddleware = require('../middlewares/auth.middleware');
const transactionController = require('../controller/transaction.controller');

const trouter = express.Router();


trouter.post('/', authmiddleware.authMiddleware, transactionController.createTransaction);
trouter.post('/system/initiate', authmiddleware.authsystemuser, transactionController.initiateSystemTransaction);






module.exports = trouter;