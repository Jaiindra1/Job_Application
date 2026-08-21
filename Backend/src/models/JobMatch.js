const mongoose=require('mongoose');
const schema=new mongoose.Schema({userId:{type:String,required:true,index:true},jobId:{type:mongoose.Schema.Types.ObjectId,ref:'Job',required:true,index:true},profileVersion:{type:Date,index:true},scoringVersion:{type:String,default:'legacy',index:true},cacheKey:{type:String,required:true,unique:true,index:true},model:{type:String,required:true},result:{type:mongoose.Schema.Types.Mixed,required:true},generatedAt:{type:Date,default:Date.now}},{timestamps:true});
schema.index({userId:1,jobId:1,createdAt:-1});
module.exports=mongoose.model('JobMatch',schema);
