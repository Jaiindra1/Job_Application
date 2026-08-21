const crypto=require('crypto');
const mongoose=require('mongoose');
const User=require('../models/User');
const developmentSecret=crypto.randomBytes(48).toString('base64url');
if(!process.env.JWT_SECRET&&process.env.NODE_ENV==='production')throw new Error('JWT_SECRET is required in production');
if(!process.env.JWT_SECRET&&process.env.NODE_ENV!=='test')console.warn('JWT_SECRET is not configured; sessions will reset when the backend restarts.');
const secret=()=>process.env.JWT_SECRET||developmentSecret;
function signToken(id){const now=Date.now(),payload=Buffer.from(JSON.stringify({sub:id,iat:now,exp:now+604800000,typ:'access'})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',secret()).update(payload).digest('base64url')}
async function requireAuth(req,res,next){try{const value=req.headers.authorization||'';if(!/^Bearer\s+\S+$/i.test(value))throw 0;const[p,s]=value.replace(/^Bearer\s+/i,'').split('.');const actual=Buffer.from(s||'','base64url'),expected=crypto.createHmac('sha256',secret()).update(p||'').digest();if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw 0;const data=JSON.parse(Buffer.from(p,'base64url'));if(data.typ!=='access'||!mongoose.isValidObjectId(data.sub)||data.exp<Date.now()||data.iat>Date.now()+60000)throw 0;if(!await User.exists({_id:data.sub}))throw 0;req.userId=String(data.sub);next()}catch{return res.status(401).json({success:false,message:'Authentication required'})}}
module.exports={signToken,requireAuth};
