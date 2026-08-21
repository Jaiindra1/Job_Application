const mongoose=require('mongoose');
const schema=new mongoose.Schema({userId:{type:String,required:true,index:true},jobId:{type:mongoose.Schema.Types.ObjectId,ref:'Job',required:true,index:true},content:{type:String,required:true,trim:true,maxlength:20000},tone:{type:String,enum:['professional','confident','concise'],required:true},length:{type:String,enum:['short','medium'],required:true}},{timestamps:true});
schema.index({userId:1,jobId:1,createdAt:-1});
module.exports=mongoose.model('CoverLetterDraft',schema);
