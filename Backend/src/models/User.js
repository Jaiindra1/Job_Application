const mongoose=require('mongoose');
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true,select:false},resetTokenHash:{type:String,select:false},resetTokenExpires:{type:Date,select:false}},{timestamps:true});
module.exports=mongoose.model('User',schema);
