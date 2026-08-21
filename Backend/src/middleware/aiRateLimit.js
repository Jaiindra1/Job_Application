const attempts=new Map();
const windowMs=60000,maxRequests=10;
function aiRateLimit(req,res,next){const now=Date.now(),key=req.userId||req.ip,current=attempts.get(key);if(!current||current.resetAt<=now){attempts.set(key,{count:1,resetAt:now+windowMs});return next()}if(current.count>=maxRequests)return res.status(429).json({success:false,message:'AI request limit reached. Please wait a minute and try again.'});current.count+=1;next()}
module.exports={aiRateLimit};
