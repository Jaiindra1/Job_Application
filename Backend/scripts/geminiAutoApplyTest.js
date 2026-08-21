require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Profile = require('../src/models/Profile');
const Resume = require('../src/models/Resume');
const Job = require('../src/models/Job');
const { generateApplicationPreparation } = require('../src/services/ai/aiService');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const resume = await Resume.findOne({ extractionStatus: 'completed', extractedText: { $nin: ['', null] } });
  if (!resume) throw new Error('No completed resume available');
  const profile = await Profile.findOne({ userId: resume.userId });
  if (!profile) throw new Error('No matching profile available');
  const job = await Job.findOne({ isActive: true, expiredAt: null, description: { $nin: ['', null] } }).sort({ postedAt: -1 });
  if (!job) throw new Error('No active job available');
  const prepared = await generateApplicationPreparation(job, profile, resume, { generateCoverLetter: true, generateAnswers: true });
  const valid = Boolean(prepared.coverLetter && prepared.summary && Array.isArray(prepared.answers) && prepared.answers.every(item => item.question && item.answer));
  console.log(JSON.stringify({ geminiPreparation: valid ? 'PASS' : 'FAIL', coverLetterGenerated: Boolean(prepared.coverLetter), summaryGenerated: Boolean(prepared.summary), answersGenerated: prepared.answers.length, contentPrinted: false }));
  if (!valid) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
