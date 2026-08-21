const Job=require('../../models/Job');

const staleHours=()=>Math.min(Math.max(Number(process.env.JOB_STALE_HOURS)||48,1),720);

async function refreshJobLifecycle(){
  const now=new Date(),staleMs=staleHours()*3600000;
  await Job.updateMany({$or:[{lastSeenAt:{$exists:false}},{staleAt:{$exists:false}},{isActive:{$exists:false}}]},[{$set:{lastSeenAt:{$ifNull:['$lastSeenAt',{$ifNull:['$fetchedAt',{$ifNull:['$updatedAt','$createdAt']}]}]},isActive:{$ifNull:['$isActive',true]},expiredAt:{$ifNull:['$expiredAt',null]}}},{$set:{staleAt:{$ifNull:['$staleAt',{$dateAdd:{startDate:'$lastSeenAt',unit:'millisecond',amount:staleMs}}]}}}],{updatePipeline:true});
  await Job.updateMany({isActive:true,expiredAt:null,staleAt:{$lte:now}},{$set:{isActive:false}});
}

module.exports={refreshJobLifecycle,staleHours};
