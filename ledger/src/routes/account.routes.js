const express = require('express');
const authmiddleware= require('../middlewares/auth.middleware').authMiddleware;
const accountsController = require('../controller/accounts.controller');
const router = express.Router();

/* 
* - post /api/accounts/ - Create a new account for the authenticated user
*/
router.post('/', authmiddleware, accountsController.createAccount);

/* 
get /api/accounts/ - Get all accounts for the authenticated user
*/

router.get('/', authmiddleware, accountsController.getAccounts);


/* 
    deposit funds to account
*/
router.post('/deposit', authmiddleware, accountsController.deposit);
router.get('/balance/:accountId', authmiddleware, accountsController.getBalance);

module.exports = router;