const usermodel=require('../models/user.model');
const jwt=require('jsonwebtoken');
const emailService=require('../services/email.service');
const tokenBlacklistModel=require('../models/blacklist.model');
/** 
 * - user register controller
 * - post /api/auth/register
*/
async function userRegister(req,res){
    const {email,password,name}=req.body;

    const isUserPresent=await usermodel.findOne({email});
    if(isUserPresent){
        return res.status(400).json({
            message:"User already exists"
        })
    }

    const user=await usermodel.create({
        email,
        password,
        name
    })

    const token=jwt.sign({
        id:user._id,
        email:user.email
    },process.env.JWT_SECRET,{
        expiresIn:'1d'
    })

    res.cookie('token',token)

    await emailService.sendRegisterEmail(user.email,user.name);

    return res.status(201).json({
        message:"User registered successfully",
        user:{
            id:user._id,
            email:user.email,
            name:user.name
        },token
    })



}


/** 
 * - user login controller
 * - post /api/auth/login
*/
async function userLogin(req,res){
    const {email,password}=req.body;

    const user= await usermodel.findOne({email}).select('+password');
    if(!user){
        return res.status(400).json({
            message:"Invalid email or password"
        })
    }

  const isvalidpass=await user.comparePassword(password);

  if(!isvalidpass){
      return res.status(400).json({
          message:"Invalid email or password"
      })
  }

      const token=jwt.sign({
        id:user._id,
        email:user.email
    },process.env.JWT_SECRET,{
        expiresIn:'1d'
    })

    res.cookie('token',token)


    return res.status(200).json({
        message:"User logged in successfully",
        user:{
            id:user._id,
            email:user.email,
            name:user.name
        },token
    })


}


async function userLogout(req,res){

    const token=req.cookies.token || req.headers.authorization?.split(' ')[1];
    if(!token ){
        return res.status(400).json({
            message:"Token not found"
        })
    }

    res.clearCookie('token');
    
    await tokenBlacklistModel.create({token});

    return res.status(200).json({
        message:"User logged out successfully"
    })
    
}


module.exports={
    userRegister,
    userLogin,
    userLogout
}