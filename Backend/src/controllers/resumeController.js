const fs=require('fs/promises');
const path=require('path');
const mongoose=require('mongoose');
const Resume=require('../models/Resume');
const Profile=require('../models/Profile');
const httpError=require('../utils/httpError');
const {uploadDirectory}=require('../middleware/resumeUpload');
const {extractResumeText}=require('../services/resume/textExtractionService');
const {analyzeResume}=require('../services/ai/aiService');

function publicResume(resume){if(!resume)return null;const value=resume.toObject?resume.toObject():{...resume};delete value.storedFilename;return value}
function safePath(filename){if(!filename||path.basename(filename)!==filename)return null;const resolved=path.resolve(uploadDirectory,filename);return resolved.startsWith(`${uploadDirectory}${path.sep}`)?resolved:null}
async function removeStoredFile(filename){const target=safePath(filename);if(target)await fs.unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error})}
async function hasValidSignature(file){const content=await fs.readFile(file.path);if(file.mimetype==='application/pdf')return content.subarray(0,5).toString()==='%PDF-';if(file.mimetype==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){const zip=content[0]===0x50&&content[1]===0x4b;const wordPackage=content.includes(Buffer.from('word/'))||content.includes(Buffer.from('word\\'));return zip&&content.includes(Buffer.from('[Content_Types].xml'))&&wordPackage}return false}

async function runExtraction(resume){
  const stored=await Resume.findById(resume._id).select('+storedFilename');
  const target=safePath(stored?.storedFilename);
  if(!target)throw httpError(404,'Stored resume file was not found');
  stored.extractionStatus='processing';stored.extractionError='';await stored.save();
  try{
    const text=await extractResumeText(target,stored.mimeType);
    stored.extractedText=text;stored.rawText=text;stored.extractedAt=new Date();stored.extractionStatus='completed';stored.status='ready';stored.extractionError='';
  }catch(error){stored.extractedText='';stored.rawText='';stored.extractedAt=undefined;stored.extractionStatus='failed';stored.status='failed';stored.extractionError='Unable to extract readable text from this file';}
  await stored.save();return stored;
}

async function mergeIntoProfile(parsed,userId){
  let profile=await Profile.findOne({userId});
  if(!profile)profile=new Profile({userId});
  const mappings={name:parsed.name,email:parsed.email,phone:parsed.phone,location:parsed.location,summary:parsed.summary,workExperience:parsed.experience||[],skills:parsed.skills||[],education:parsed.education||[],projects:parsed.projects||[],certifications:parsed.certifications||[],jobTitles:parsed.jobTitles||[],technologies:parsed.technologies||[],currentRole:parsed.jobTitles?.[0]||''};
  const sources={...(profile.fieldSources||{})};
  for(const[field,value]of Object.entries(mappings)){const hasValue=Array.isArray(value)?value.length>0:Boolean(value),existing=profile[field],hasExisting=Array.isArray(existing)?existing.length>0:Boolean(existing);if(hasValue&&!hasExisting&&sources[field]!=='user'){profile[field]=value;sources[field]='ai'}}
  profile.fieldSources=sources;
  await profile.save();return profile;
}

async function parseAndSyncProfile(resume,userId){
  resume.parsingStatus='processing';await resume.save();
  try{
    const analysis=await analyzeResume(resume.extractedText),parsed=analysis.data;
    resume.parsedData=parsed;resume.parsedAt=new Date();resume.parsingStatus='completed';resume.parsingModel=analysis.model;resume.parsingError='';resume.skills=parsed.skills;resume.experience=parsed.experience;resume.education=parsed.education;resume.projects=parsed.projects;
    await resume.save();
    const profile=await mergeIntoProfile(parsed,userId);
    return {resume,profile};
  }catch(error){resume.parsingStatus='failed';resume.parsingError=error.message||'Resume analysis failed';await resume.save();throw error}
}

exports.get=async(req,res)=>{const resume=await Resume.findOne({userId:req.userId});res.json({success:true,message:'Resume fetched successfully',data:publicResume(resume),resume:publicResume(resume)})};
exports.upload=async(req,res)=>{
  if(!req.file)throw httpError(400,'Please choose a PDF or DOCX resume');
  try{
    if(!await hasValidSignature(req.file))throw httpError(400,'The uploaded file content is not a valid PDF or DOCX');
    const previous=await Resume.findOne({userId:req.userId}).select('+storedFilename');
    const originalFilename=path.basename(req.file.originalname).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,255)||'resume';
    let resume=await Resume.findOneAndUpdate({userId:req.userId},{$set:{fileName:originalFilename,originalFilename,storedFilename:req.file.filename,mimeType:req.file.mimetype,fileSize:req.file.size,uploadedAt:new Date(),status:'uploaded',extractedText:'',extractedAt:null,extractionStatus:'pending',extractionError:'',parsedData:null,parsedAt:null,parsingStatus:'pending',parsingModel:'',parsingError:'',rawText:'',skills:[],experience:[],education:[],projects:[]},$setOnInsert:{userId:req.userId}},{returnDocument:"after",upsert:true,runValidators:true});
    if(previous?.storedFilename&&previous.storedFilename!==req.file.filename)await removeStoredFile(previous.storedFilename);
    resume=await runExtraction(resume);
    const success=resume.extractionStatus==='completed';
    res.status(201).json({success:true,message:success?(previous?'Resume replaced and text extracted successfully':'Resume uploaded and text extracted successfully'):'Resume uploaded, but text extraction failed',data:publicResume(resume),resume:publicResume(resume)});
  }catch(error){await removeStoredFile(req.file.filename);throw error}
};
exports.extract=async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw httpError(400,'Invalid resume ID');const resume=await Resume.findOne({_id:req.params.id,userId:req.userId});if(!resume)throw httpError(404,'Resume not found');const extracted=await runExtraction(resume),completed=extracted.extractionStatus==='completed';res.status(completed?200:422).json({success:completed,message:completed?'Resume text extracted successfully':'Unable to extract text. Please upload another file.',data:publicResume(extracted),resume:publicResume(extracted)})};
exports.parse=async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw httpError(400,'Invalid resume ID');const resume=await Resume.findOne({_id:req.params.id,userId:req.userId});if(!resume)throw httpError(404,'Resume not found');if(resume.extractionStatus!=='completed'||!resume.extractedText?.trim())throw httpError(409,'Extract the resume text before parsing');try{const result=await parseAndSyncProfile(resume,req.userId);res.json({success:true,message:'Resume analyzed successfully. Existing confirmed profile fields were preserved.',data:{resume:publicResume(result.resume),profile:result.profile},resume:publicResume(result.resume),profile:result.profile})}catch(error){if(error.statusCode)throw error;throw httpError(422,'Unable to parse structured resume information')}};
exports.remove=async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw httpError(400,'Invalid resume ID');const resume=await Resume.findOneAndDelete({_id:req.params.id,userId:req.userId}).select('+storedFilename');if(!resume)throw httpError(404,'Resume not found');await removeStoredFile(resume.storedFilename);res.json({success:true,message:'Resume deleted successfully',data:null})};
