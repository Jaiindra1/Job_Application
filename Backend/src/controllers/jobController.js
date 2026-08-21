const mongoose = require('mongoose');
const Job = require('../models/Job');
const httpError = require('../utils/httpError');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const CoverLetterDraft = require('../models/CoverLetterDraft');
const { matchJobToProfile, generateCoverLetter } = require('../services/ai/aiService');
const { refreshJobLifecycle } = require('../services/jobs/jobLifecycleService');
const { matchesExperience } = require('../utils/experienceRange');
const { matchesSalary } = require('../utils/salaryRange');
const { notify } = require('../services/notificationService');
const { classifyJob, backfillJobClassifications } = require('../services/jobs/jobClassifier');
const { calculateJobMatch } = require('../services/jobs/jobMatchScoring');

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.create = async (req, res) => {
  const job = await Job.create({...req.body,...classifyJob(req.body)});
  res.status(201).json({ success: true, message: 'Job created successfully', data: job, job });
};

exports.list = async (req, res) => {
  let { search, location, skill, skills, experience, jobType, workMode, source, company, salary, posted, postedDays, includeInactive, includeExpired, category, subcategory, recommended, page = 1, limit = 10, sort = 'newest' } = req.query;
  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const filter = {};
  const conditions = [];

  await backfillJobClassifications(Job);
  await refreshJobLifecycle();
  if(includeInactive!=='true'&&includeExpired!=='true'){filter.isActive=true;filter.expiredAt=null;filter.staleAt={$gt:new Date()}}

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    conditions.push({ $or: [{ title: regex }, { company: regex }, { description: regex }, { skills: regex }] });
  }
  if (location) filter.location = new RegExp(escapeRegex(location), 'i');
  if (company) filter.company = new RegExp(escapeRegex(company), 'i');
  const requestedSkills=skill||skills;
  if (requestedSkills) {
    for (const requestedSkill of String(requestedSkills).split(',').map(value => value.trim()).filter(Boolean)) {
      const regex = new RegExp(escapeRegex(requestedSkill), 'i');
      conditions.push({ $or: [{ skills: regex }, { title: regex }, { description: regex }] });
    }
  }
  if (jobType) filter.jobType = new RegExp(`^${escapeRegex(jobType)}$`,'i');
  if (workMode) filter.workMode = new RegExp(`^${escapeRegex(workMode)}$`,'i');
  if (source) filter.source = new RegExp(`^${escapeRegex(source)}$`, 'i');
  if(category){if(!['IT','NON_IT','UNKNOWN'].includes(category))throw httpError(400,'category must be IT, NON_IT, or UNKNOWN');filter.category=category}
  if(subcategory){if(!/^[A-Z_]+$/.test(subcategory))throw httpError(400,'Invalid subcategory');filter.subcategory=subcategory}
  if(recommended==='true')filter.category='IT';
  let postedAfter;
  const requestedPosted=posted??postedDays;
  if (requestedPosted) {
    const days = Number(requestedPosted);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw httpError(400, 'postedDays must be between 1 and 365');
    postedAfter = new Date(Date.now() - days * 86400000);
  }
  if (postedAfter) filter.postedAt = { $gte: postedAfter };
  if (conditions.length) filter.$and = conditions;

  const sorts = { newest: { postedAt: -1, createdAt: -1 }, oldest: { postedAt: 1 }, company: { company: 1 }, title: { title: 1 }, salary:{salaryMax:-1,postedAt:-1},bestMatch:{postedAt:-1,createdAt:-1} };
  let matchingJobs=await Job.find(filter).sort(sorts[sort]||sorts.newest).lean();
  if(experience)matchingJobs=matchingJobs.filter(job=>matchesExperience(`${job.experience||''} ${job.description||''}`,experience));
  if(salary)matchingJobs=matchingJobs.filter(job=>matchesSalary(job,salary));
  if(recommended==='true'){
    const profile=await Profile.findOne({userId:req.userId});if(!profile)throw httpError(409,'Complete your profile before requesting recommendations');
    matchingJobs=matchingJobs.map(job=>({...job,...(()=>{const match=calculateJobMatch(job,profile,{});return{matchScore:match.score,matchLevel:match.level,roleRelevance:match.roleRelevance}})()})).filter(job=>job.roleRelevance>=.4||job.matchScore>=40).sort((a,b)=>b.matchScore-a.matchScore||b.roleRelevance-a.roleRelevance||new Date(b.postedAt||b.createdAt)-new Date(a.postedAt||a.createdAt));
  }
  const total=matchingJobs.length,totalPages=Math.ceil(total/limit),jobs=matchingJobs.slice((page-1)*limit,page*limit);
  const pagination={page,limit,total,totalPages,hasNextPage:page<totalPages,hasPreviousPage:page>1};
  res.json({success:true,message:'Jobs fetched successfully',data:jobs,pagination,jobs,count:jobs.length,totalJobs:total,currentPage:page,totalPages,recommended:recommended==='true'});
};

exports.getOne = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid job ID');
  const job = await Job.findById(req.params.id);
  if (!job) throw httpError(404, 'Job not found');
  res.json({ success: true, message: 'Job fetched successfully', data: job, job });
};

exports.match = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid job ID');
  const [job, profile] = await Promise.all([Job.findById(req.params.id), Profile.findOne({ userId: req.userId })]);
  if (!job) throw httpError(404, 'Job not found');
  if (!profile) throw httpError(409, 'Complete your profile before generating a match explanation');
  const match = await matchJobToProfile(job, profile, req.userId, req.body?.force === true);
  if(match.score>=80)await notify(req.userId,{type:'HIGH_MATCH_JOB',title:'New highly matched job',message:`${job.title} at ${job.company} is a ${match.score}% match.`,relatedJob:job._id,dedupeKey:`high-match:${job._id}:${profile.updatedAt?.getTime?.()||profile.updatedAt}`});
  res.json({ success: true, message: match.cached ? 'Cached job match fetched successfully' : 'Job match generated successfully', data: match, match });
};

const coverLetterOptions=req=>{const tone=req.body.tone||'professional',length=req.body.length||'medium';if(!['professional','confident','concise'].includes(tone))throw httpError(400,'Tone must be professional, confident, or concise');if(!['short','medium'].includes(length))throw httpError(400,'Length must be short or medium');return{tone,length}};
exports.coverLetter=async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw httpError(400,'Invalid job ID');const[job,profile,resume]=await Promise.all([Job.findById(req.params.id),Profile.findOne({userId:req.userId}),Resume.findOne({userId:req.userId})]);if(!job)throw httpError(404,'Job not found');if(!profile)throw httpError(409,'Complete your profile before generating a cover letter');if(!resume||resume.extractionStatus!=='completed'||!resume.extractedText.trim())throw httpError(409,'Upload and extract your resume before generating a cover letter');const data=await generateCoverLetter(job,profile,resume,coverLetterOptions(req));res.json({success:true,message:'Cover letter generated successfully. It has not been saved.',data})};
exports.saveCoverLetterDraft=async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw httpError(400,'Invalid job ID');if(!await Job.exists({_id:req.params.id}))throw httpError(404,'Job not found');const content=String(req.body.content||'').trim();if(!content)throw httpError(400,'Cover letter text is required');if(content.length>20000)throw httpError(400,'Cover letter must be 20,000 characters or fewer');const options=coverLetterOptions(req),draft=await CoverLetterDraft.create({userId:req.userId,jobId:req.params.id,content,...options});res.status(201).json({success:true,message:'Cover letter draft saved',data:{id:draft._id,jobId:draft.jobId,content:draft.content,tone:draft.tone,length:draft.length,createdAt:draft.createdAt}})};
