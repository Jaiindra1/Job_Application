const gmail=require('../services/gmailService');

exports.auth=async(req,res)=>res.json({success:true,message:'Gmail authorization URL created',data:{authUrl:gmail.authorizationUrl(req.userId)}});
exports.callback=async(req,res)=>{if(req.query.error){const error=new Error('Gmail authorization was denied');error.statusCode=400;throw error}if(!req.query.code||!req.query.state){const error=new Error('Missing Gmail authorization response');error.statusCode=400;throw error}const connection=await gmail.exchangeCode(req.query.code,req.query.state),redirect=process.env.GMAIL_SUCCESS_REDIRECT;if(redirect)return res.redirect(redirect);res.json({success:true,message:'Gmail connected successfully',data:{connected:true,email:connection.email}})};
exports.status=async(req,res)=>res.json({success:true,message:'Gmail connection status fetched',data:await gmail.status(req.userId)});
exports.sync=async(req,res)=>res.json({success:true,message:'Gmail sync completed',data:await gmail.sync(req.userId)});
exports.disconnect=async(req,res)=>res.json({success:true,message:'Gmail disconnected successfully',data:await gmail.disconnect(req.userId)});
