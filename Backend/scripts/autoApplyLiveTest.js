require('dotenv').config({quiet:true});
const mongoose=require('mongoose');
const {signToken}=require('../src/middleware/auth');
const User=require('../src/models/User'),Profile=require('../src/models/Profile'),Resume=require('../src/models/Resume'),Job=require('../src/models/Job'),Application=require('../src/models/Application'),Draft=require('../src/models/AutoApplyDraft'),CoverLetterDraft=require('../src/models/CoverLetterDraft'),Event=require('../src/models/ApplicationEvent');
const base=`http://127.0.0.1:${process.env.PORT||7000}/api`;
const results=[];const record=(name,pass,detail='')=>results.push({name,status:pass?'PASS':'FAIL',detail});
async function request(path,token,options={}){const response=await fetch(base+path,{...options,headers:{Authorization:`Bearer ${token}`,...(options.body&&{'Content-Type':'application/json'})}}),payload=await response.json().catch(()=>({}));return{response,payload}}
async function main(){
 await mongoose.connect(process.env.MONGODB_URI);record('MongoDB connection',true);
 const resumes=await Resume.find({extractionStatus:'completed',extractedText:{$nin:['',null]}}).select('+extractedText');let selected;
 for(const resume of resumes){if(!mongoose.isValidObjectId(resume.userId))continue;const[user,profile]=await Promise.all([User.findById(resume.userId),Profile.findOne({userId:resume.userId})]);if(user&&profile){selected={user,profile,resume};break}}
 if(!selected)throw new Error('No authenticated user has both a confirmed profile and completed extracted resume');
 const{user,profile,resume}=selected,token=signToken(String(user._id)),originalSettings=profile.autoApplySettings?.toObject?.()||profile.autoApplySettings;
 const marker=`auto-apply-live-${Date.now()}`,now=new Date(),future=new Date(Date.now()+7*86400000),past=new Date(Date.now()-86400000),fixtureApplicationIds=[];let fixtureIds=[];
 try{
  let test=await request('/auto-apply/settings',token);record('GET settings',test.response.status===200&&test.payload.success,`HTTP ${test.response.status}`);
  const desired={minimumMatchScore:0,categories:['IT'],subcategories:[],preferredRoles:[],preferredLocations:[],workModes:[],generateCoverLetter:true,generateAnswers:true,requireReview:true};
  test=await request('/auto-apply/settings',token,{method:'PUT',body:JSON.stringify(desired)});record('PUT settings',test.response.status===200&&test.payload.data?.categories?.includes('IT'),`HTTP ${test.response.status}`);
  const common={company:'Live Verification',location:'Remote',description:'React JavaScript software engineering role.',skills:['React','JavaScript'],experience:'',jobType:'Full-time',workMode:'Remote',source:'verification',postedAt:now,fetchedAt:now,lastSeenAt:now,staleAt:future,expiredAt:null,isActive:true,categoryConfidence:1,classificationVersion:'test'};
  const inserted=await Job.collection.insertMany([
   {...common,title:'Frontend Developer',sourceJobId:`${marker}-expired`,originalUrl:'https://example.com/expired',category:'IT',subcategory:'FRONTEND',expiredAt:past,isActive:false},
   {...common,title:'Sales Manager',sourceJobId:`${marker}-nonit`,originalUrl:'https://example.com/nonit',category:'NON_IT',subcategory:'SALES'},
   {...common,title:'React Developer',sourceJobId:`${marker}-invalid`,originalUrl:'not-a-valid-url',category:'IT',subcategory:'FRONTEND'},
   {...common,title:'Frontend Software Engineer',sourceJobId:`${marker}-applied`,originalUrl:'https://example.com/applied',category:'IT',subcategory:'FRONTEND'}
  ]);fixtureIds=Object.values(inserted.insertedIds);
  const existing=await Application.create({userId:String(user._id),jobId:fixtureIds[3],status:'Applied'});fixtureApplicationIds.push(existing._id);
  test=await request('/auto-apply/jobs?page=1&limit=10',token);const jobs=test.payload.data?.jobs||[],allIT=jobs.every(job=>job.category==='IT'),allEligible=jobs.every(job=>job.applicationEligibility?.eligible&&job.matchScore>=0);
  record('GET eligible jobs',test.response.status===200&&allEligible,`HTTP ${test.response.status}; returned ${jobs.length}`);record('IT category filter',allIT,`${jobs.length} checked`);
  const returnedIds=new Set(jobs.map(job=>String(job._id)));record('Expired protection',!returnedIds.has(String(fixtureIds[0])));record('Non-IT exclusion',!returnedIds.has(String(fixtureIds[1])));record('Invalid URL exclusion',!returnedIds.has(String(fixtureIds[2])));record('Already-applied exclusion',!returnedIds.has(String(fixtureIds[3])));
  const baselineTotal=test.payload.data?.pagination?.total||0;
  const threshold=85;test=await request(`/auto-apply/jobs?page=1&limit=10&minMatchScore=${threshold}`,token);const thresholdJobs=test.payload.data?.jobs||[];record('Minimum score exclusion',test.response.status===200&&thresholdJobs.every(job=>job.matchScore>=threshold),`${thresholdJobs.length} returned at >=${threshold}`);
  const p1=await request('/auto-apply/jobs?page=1&limit=1',token),p2=await request('/auto-apply/jobs?page=2&limit=1',token),pg1=p1.payload.data?.pagination,pg2=p2.payload.data?.pagination;record('Pagination',p1.response.status===200&&pg1?.limit===1&&pg1?.page===1&&pg1?.total===baselineTotal&&(baselineTotal<2||pg2?.page===2),`total=${baselineTotal}, pages=${pg1?.totalPages}`);
  const eligible=(await request('/auto-apply/jobs?page=1&limit=10&minMatchScore=0',token)).payload.data?.jobs||[],job=eligible.find(item=>!fixtureIds.some(id=>String(id)===String(item._id)));
  if(!job)throw new Error('No genuine stored eligible IT job is available for Gemini preparation');
  const prepared=await request('/auto-apply/prepare',token,{method:'POST',body:JSON.stringify({jobIds:[job._id]})}),draft=prepared.payload.data?.[0];record('Gemini preparation HTTP',prepared.response.status===201,`HTTP ${prepared.response.status}`);record('Gemini cover letter',Boolean(draft?.coverLetter?.trim()),`length=${draft?.coverLetter?.length||0}`);record('Gemini answers',Array.isArray(draft?.answers)&&draft.answers.length>0&&draft.answers.every(a=>a.question&&a.answer),`count=${draft?.answers?.length||0}`);record('Gemini summary',Boolean(draft?.summary?.trim()),`length=${draft?.summary?.length||0}`);
  const source=`${JSON.stringify(profile.toObject())} ${resume.extractedText} ${JSON.stringify(job)}`.toLowerCase(),generated=`${draft?.coverLetter||''} ${draft?.summary||''} ${JSON.stringify(draft?.answers||[])}`.toLowerCase(),yearClaims=[...generated.matchAll(/\b(\d+(?:\.\d+)?)\+?\s+years?\b/g)].map(m=>m[0]),unsupportedYears=[...new Set(yearClaims.filter(claim=>!source.includes(claim)))];record('Truthfulness evidence check',unsupportedYears.length===0,unsupportedYears.length?`unsupported experience claims=${unsupportedYears.join(',')}`:'no unsupported numeric experience claims; manual semantic review still required');
  const persisted=await Draft.findOne({_id:draft?._id,userId:String(user._id),jobId:job._id});record('Draft persistence',Boolean(persisted));
  const patched=await request(`/auto-apply/drafts/${draft._id}`,token,{method:'PATCH',body:JSON.stringify({summary:`${draft.summary}\nReviewed during live verification.`,status:'Reviewed'})});record('PATCH draft',patched.response.status===200&&patched.payload.data?.status==='Reviewed',`HTTP ${patched.response.status}`);
  const saved=await request(`/auto-apply/drafts/${draft._id}/save-cover-letter`,token,{method:'POST'}),savedId=saved.payload.data?.id;record('Save cover letter',saved.response.status===201&&mongoose.isValidObjectId(savedId)&&Boolean(await CoverLetterDraft.exists({_id:savedId,userId:String(user._id)})),`HTTP ${saved.response.status}`);
  const applied=await request(`/auto-apply/drafts/${draft._id}/mark-applied`,token,{method:'POST'}),applicationId=applied.payload.data?._id;record('Mark applied',applied.response.status===201&&Boolean(await Application.exists({_id:applicationId,userId:String(user._id),jobId:job._id})),`HTTP ${applied.response.status}`);
  const duplicate=await request(`/auto-apply/drafts/${draft._id}/mark-applied`,token,{method:'POST'});record('Duplicate application prevention',duplicate.response.status===409,`HTTP ${duplicate.response.status}`);
  const history=await request('/auto-apply/history',token),historyItem=history.payload.data?.find(item=>String(item._id)===String(draft._id));record('History status',history.response.status===200&&historyItem?.status==='Applied',historyItem?.status||'missing');
  const dashboard=await request('/dashboard/summary',token),metrics=dashboard.payload.data?.autoApply;record('Dashboard metrics',dashboard.response.status===200&&metrics?.applied>=1&&metrics?.prepared>=1,JSON.stringify(metrics||{}));
  console.log(JSON.stringify({userId:String(user._id),jobId:String(job._id),draftId:String(draft?._id||''),applicationId:String(applicationId||''),results},null,2));
 }finally{
  if(fixtureApplicationIds.length)await Application.deleteMany({_id:{$in:fixtureApplicationIds}});
  if(fixtureIds.length)await Job.deleteMany({_id:{$in:fixtureIds}});
  if(originalSettings)await Profile.updateOne({_id:profile._id},{$set:{autoApplySettings:originalSettings}});else await Profile.updateOne({_id:profile._id},{$unset:{autoApplySettings:1}});
  await mongoose.disconnect();
 }
}
main().catch(async error=>{console.error(JSON.stringify({fatal:error.message}));try{await mongoose.disconnect()}catch{}process.exit(1)});
