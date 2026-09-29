const express= require('express');
const authRoutes=require('./routes/auth.routes');
const cookieParser=require('cookie-parser');
const accRoutes=require('./routes/account.routes');
const transactionRoutes=require('./routes/transaction.routes');
const app=express();

app.use(express.json());
app.use(cookieParser());


app.get('/',(req,res)=>{
    res.send('Welcome to the Banking API');
});
app.use('/api/auth/',authRoutes);
app.use('/api/accounts/',accRoutes);
app.use('/api/transactions/',transactionRoutes);


module.exports=app;

