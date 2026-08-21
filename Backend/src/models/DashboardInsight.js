const mongoose=require('mongoose');
const schema=new mongoose.Schema({userId:{type:String,required:true,index:true},cacheKey:{type:String,required:true,unique:true,index:true},model:{type:String,required:true},summary:{type:String,required:true},generatedAt:{type:Date,default:Date.now}},{timestamps:true});
schema.index({userId:1,createdAt:-1});
module.exports=mongoose.model('DashboardInsight',schema);
