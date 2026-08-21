const mongoose=require('mongoose');
const schema=new mongoose.Schema({userId:{type:String,required:true,unique:true,index:true},email:{type:String,default:''},accessToken:{type:mongoose.Schema.Types.Mixed,required:true},refreshToken:{type:mongoose.Schema.Types.Mixed,default:null},tokenExpiresAt:{type:Date,required:true},scope:{type:[String],default:[]},connectedAt:{type:Date,default:Date.now},lastSyncedAt:{type:Date,default:null}},{timestamps:true});
module.exports=mongoose.model('GmailConnection',schema);
