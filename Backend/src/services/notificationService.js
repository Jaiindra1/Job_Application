const Notification=require('../models/Notification');
async function notify(userId,data){if(!userId||!data?.dedupeKey)return null;return Notification.findOneAndUpdate({userId,dedupeKey:data.dedupeKey},{$setOnInsert:{userId,type:data.type,title:data.title,message:data.message,relatedApplication:data.relatedApplication||null,relatedJob:data.relatedJob||null,dedupeKey:data.dedupeKey,read:false}},{returnDocument:"after",upsert:true,runValidators:true}).catch(error=>{if(error.code===11000)return Notification.findOne({userId,dedupeKey:data.dedupeKey});throw error})}
module.exports={notify};
