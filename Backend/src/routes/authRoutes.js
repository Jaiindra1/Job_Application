const express=require('express');
const crypto=require('crypto');
const User=require('../models/User');
const {promisify}=require('util');
const {signToken,requireAuth}=require('../middleware/auth');
const scrypt=promisify(crypto.scrypt),router=express.Router(),attempts=new Map();

function authLimit(req,res,next){const now=Date.now(),key=`${req.ip}:${req.path}`,current=attempts.get(key);if(!current||current.resetAt<=now){attempts.set(key,{count:1,resetAt:now+900000});return next()}if(current.count>=10)return res.status(429).json({message:'Too many authentication attempts. Try again later.'});current.count+=1;next()}
router.use(['/login','/signup','/forgot-password','/reset-password'],authLimit);
async function hash(password,salt=crypto.randomBytes(16).toString('hex')){return salt+':'+(await scrypt(password,salt,64)).toString('hex')}
async function match(password,value){try{const[salt,stored]=value.split(':'),actual=Buffer.from((await hash(password,salt)).split(':')[1],'hex'),expected=Buffer.from(stored,'hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}catch{return false}}
const clean=user=>({id:user._id,name:user.name,email:user.email});

router.post('/signup',async(req,res)=>{try{const{name,email,password}=req.body;if(!name?.trim()||name.trim().length>120||!/^\S+@\S+\.\S+$/.test(email||'')||String(email).length>254||typeof password!=='string'||password.length<8||password.length>128)return res.status(400).json({message:'Enter a valid name, email, and password between 8 and 128 characters'});const normalized=email.toLowerCase().trim();if(await User.exists({email:normalized}))return res.status(409).json({message:'Account already exists'});const user=await User.create({name:name.trim(),email:normalized,passwordHash:await hash(password)});res.status(201).json({token:signToken(String(user._id)),user:clean(user)})}catch{return res.status(500).json({message:'Could not create account'})}});
router.post('/login',async(req,res)=>{const user=await User.findOne({email:(req.body.email||'').toLowerCase().trim()}).select('+passwordHash');if(!user||!await match(String(req.body.password||''),user.passwordHash))return res.status(401).json({message:'Invalid email or password'});res.json({token:signToken(String(user._id)),user:clean(user)})});
router.post('/forgot-password',async(req,res)=>{const user=await User.findOne({email:(req.body.email||'').toLowerCase().trim()});if(user){const token=crypto.randomBytes(32).toString('hex');user.resetTokenHash=crypto.createHash('sha256').update(token).digest('hex');user.resetTokenExpires=Date.now()+900000;await user.save();if(process.env.NODE_ENV!=='test')console.warn('Password reset requested, but email delivery is not configured.')}res.json({message:'If that account exists, reset instructions were created'})});
router.post('/reset-password',async(req,res)=>{if(typeof req.body.password!=='string'||req.body.password.length<8||req.body.password.length>128)return res.status(400).json({message:'Password must be between 8 and 128 characters'});const tokenHash=crypto.createHash('sha256').update(req.body.token||'').digest('hex'),user=await User.findOne({resetTokenHash:tokenHash,resetTokenExpires:{$gt:new Date()}}).select('+resetTokenHash +resetTokenExpires');if(!user)return res.status(400).json({message:'Reset link is invalid or expired'});user.passwordHash=await hash(req.body.password);user.resetTokenHash=undefined;user.resetTokenExpires=undefined;await user.save();res.json({message:'Password reset successfully'})});
router.get('/me',requireAuth,async(req,res)=>{const user=await User.findById(req.userId);user?res.json({user:clean(user)}):res.status(401).json({message:'Account not found'})});
module.exports=router;
