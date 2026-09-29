const express= require('express');
const authcontroller=require('../controller/auth.controller');
const router=express.Router();


router.post('/register',authcontroller.userRegister);
router.post('/login',authcontroller.userLogin);

/* 
logout
*/
router.post('/logout',authcontroller.userLogout);

module.exports=router;