const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Event = require('../models/ApplicationEvent');
const Draft = require('../models/AutoApplyDraft');
const QueueJob = require('../models/AutoApplyQueueJob');
const CoverLetterDraft = require('../models/CoverLetterDraft');
const httpError = require('../utils/httpError');
const { calculateJobMatch } = require('../services/jobs/jobMatchScoring');
const { refreshJobLifecycle } = require('../services/jobs/jobLifecycleService');
const { backfillJobClassifications } = require('../services/jobs/jobClassifier');
const { generateApplicationPreparation } = require('../services/ai/aiService');
const { settingsFor, sanitizeSettings } = require('../services/autoApply/settingsService');
const { isEligibleForAutoApply } = require('../services/autoApply/eligibilityService');
const { detectApplicationPlatform } = require('../services/autoApply/platformDetector');
const { runForUser, startOfDay } = require('../services/autoApply/autoApplyEngine');
const { enqueue } = require('../services/autoApply/autoApplyQueue');
const { createAutoApplyEvent } = require('../services/autoApply/eventService');

const validId = (value, label = 'identifier') => { if (!mongoose.isValidObjectId(value)) throw httpError(400, `Invalid ${label}`); };
const cleanIds = value => {
  if (!Array.isArray(value) || !value.length || value.length > 10) throw httpError(400, 'Select between 1 and 10 valid jobs');
  const ids = [...new Set(value.map(item => String(item).trim()))];
  if (ids.some(id => !mongoose.isValidObjectId(id))) throw httpError(400, 'Select between 1 and 10 valid jobs');
  return ids;
};

async function eligibleJobs(req) {
  await Promise.all([backfillJobClassifications(Job), refreshJobLifecycle()]);
  const [profile, resume] = await Promise.all([Profile.findOne({ userId: req.userId }), Resume.findOne({ userId: req.userId })]);
  if (!profile) throw httpError(409, 'Complete your profile before using Auto Apply');
  const settings = settingsFor(profile);
  if (req.query.minMatchScore !== undefined) {
    const minimum = Number(req.query.minMatchScore);
    if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) throw httpError(400, 'minMatchScore must be between 0 and 100');
    settings.minimumMatchScore = minimum;
  }
  if (req.query.category) {
    const category = String(req.query.category).toUpperCase();
    if (!['IT', 'NON_IT', 'ALL'].includes(category)) throw httpError(400, 'category must be IT, NON_IT, or ALL');
    settings.category = category;
  }
  const jobs = await Job.find({ isActive: true, expiredAt: null, staleAt: { $gt: new Date() } }).sort({ postedAt: -1, createdAt: -1 }).lean();
  const existing = new Map((await Application.find({ userId: req.userId }).select('jobId status')).map(item => [String(item.jobId), item]));
  return jobs.map(job => {
    const match = calculateJobMatch(job, profile, {});
    const eligibility = isEligibleForAutoApply({ user: req.userId, job, settings, profile, resume, match, existingApplication: existing.get(String(job._id)), mode: 'manual' });
    return { ...job, applicationPlatform: detectApplicationPlatform(job.originalUrl), matchScore: match.score, matchLevel: match.level, matchDetails: match, applicationEligibility: eligibility };
  }).filter(job => job.applicationEligibility.eligible).sort((left, right) => right.matchScore - left.matchScore);
}

exports.getSettings = async (req, res) => {
  const profile = await Profile.findOne({ userId: req.userId });
  res.json({ success: true, data: settingsFor(profile) });
};
exports.saveSettings = async (req, res) => {
  const profile = await Profile.findOne({ userId: req.userId });
  const settings = sanitizeSettings(req.body || {}, settingsFor(profile));
  const updated = await Profile.findOneAndUpdate({ userId: req.userId }, { $set: { autoApplySettings: settings }, $setOnInsert: { userId: req.userId } }, { returnDocument: "after", upsert: true, runValidators: true });
  res.json({ success: true, message: 'Auto Apply preferences saved', data: settingsFor(updated) });
};
exports.jobs = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
  const all = await eligibleJobs(req);
  const jobs = all.slice((page - 1) * limit, page * limit).map(job => ({ _id: job._id, title: job.title, company: job.company, location: job.location, category: job.category, subcategory: job.subcategory, workMode: job.workMode, matchScore: job.matchScore, matchLevel: job.matchLevel, matchDetails: job.matchDetails, applicationPlatform: job.applicationPlatform, originalUrl: job.originalUrl, source: job.source, postedAt: job.postedAt, applicationEligibility: job.applicationEligibility }));
  res.json({ success: true, data: { jobs, pagination: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) } } });
};

exports.prepare = async (req, res) => {
  const ids = cleanIds(req.body.jobIds);
  const available = await eligibleJobs(req);
  const availableMap = new Map(available.map(job => [String(job._id), job]));
  for (const id of ids) if (!availableMap.has(id)) throw httpError(409, 'One or more selected jobs are no longer eligible');
  const [profile, resume] = await Promise.all([Profile.findOne({ userId: req.userId }), Resume.findOne({ userId: req.userId })]);
  if (!resume || resume.extractionStatus !== 'completed' || !String(resume.extractedText || '').trim()) throw httpError(409, 'Upload and extract your resume before preparing applications');
  const settings = settingsFor(profile);
  const drafts = [];
  for (const id of ids) {
    const job = availableMap.get(id);
    const prepared = await generateApplicationPreparation(job, profile, resume, settings);
    const draft = await Draft.findOneAndUpdate({ userId: req.userId, jobId: id }, {
      $set: { status: 'PREPARED', applicationPlatform: detectApplicationPlatform(job.originalUrl), applicationUrl: job.originalUrl, matchScore: job.matchScore, resumeId: resume._id, coverLetter: prepared.coverLetter, answers: prepared.answers, summary: prepared.summary, matchDetails: job.matchDetails, failureCode: '', failureReason: '' },
      $unset: { reviewedAt: 1, appliedAt: 1, submittedAt: 1, applicationId: 1 },
    }, { returnDocument: "after", upsert: true, runValidators: true });
    drafts.push(await draft.populate('jobId'));
  }
  res.status(201).json({ success: true, message: `${drafts.length} application${drafts.length === 1 ? '' : 's'} prepared successfully`, data: drafts });
};

exports.history = async (req, res) => {
  const drafts = await Draft.find({ userId: req.userId }).populate('jobId').sort({ updatedAt: -1 });
  res.json({ success: true, data: drafts });
};
exports.detail = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const draft = await Draft.findOne({ _id: req.params.id, userId: req.userId }).populate('jobId applicationId');
  if (!draft) throw httpError(404, 'Application draft not found');
  res.json({ success: true, data: draft });
};
exports.updateDraft = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const update = {};
  if (typeof req.body.coverLetter === 'string') update.coverLetter = req.body.coverLetter.trim().slice(0, 20000);
  if (typeof req.body.summary === 'string') update.summary = req.body.summary.trim().slice(0, 4000);
  if (req.body.answers !== undefined) {
    if (!Array.isArray(req.body.answers)) throw httpError(400, 'Answers must be an array');
    update.answers = req.body.answers.slice(0, 20).map(item => ({ question: String(item.question || '').trim().slice(0, 500), answer: String(item.answer || '').trim().slice(0, 4000), required: item.required === true, source: 'USER_REVIEWED' }));
  }
  if (['Reviewed', 'PREPARED'].includes(req.body.status)) { update.status = req.body.status; update.reviewedAt = new Date(); }
  const draft = await Draft.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $set: update }, { returnDocument: "after", runValidators: true }).populate('jobId');
  if (!draft) throw httpError(404, 'Application draft not found');
  res.json({ success: true, message: 'Application preparation updated', data: draft });
};
exports.saveCoverLetter = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const draft = await Draft.findOne({ _id: req.params.id, userId: req.userId });
  if (!draft) throw httpError(404, 'Application draft not found');
  if (!draft.coverLetter) throw httpError(409, 'This preparation has no cover letter');
  const saved = await CoverLetterDraft.create({ userId: req.userId, jobId: draft.jobId, content: draft.coverLetter, tone: 'professional', length: 'medium' });
  draft.coverLetterDraftId = saved._id;
  await draft.save();
  res.status(201).json({ success: true, message: 'Cover letter draft saved', data: { id: saved._id } });
};
exports.markApplied = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const draft = await Draft.findOne({ _id: req.params.id, userId: req.userId }).populate('jobId');
  if (!draft) throw httpError(404, 'Application draft not found');
  if (await Application.exists({ userId: req.userId, jobId: draft.jobId._id })) throw httpError(409, 'This job is already in your applications');
  if (!draft.jobId.isActive || draft.jobId.expiredAt || draft.jobId.staleAt <= new Date()) throw httpError(409, 'This job is no longer eligible for Auto Apply');
  const application = await Application.create({ userId: req.userId, jobId: draft.jobId._id, status: 'Applied', source: 'MANUAL', submissionMethod: 'MANUAL', applicationPlatform: draft.applicationPlatform, applicationUrl: draft.jobId.originalUrl, resumeId: draft.resumeId, coverLetterId: draft.coverLetterDraftId, preparationMetadata: { autoApplyDraftId: draft._id, matchScore: draft.matchScore } });
  await Event.create({ applicationId: application._id, type: 'APPLICATION_CREATED', source: 'manual', timestamp: application.appliedAt, title: 'Applied', description: 'User confirmed they submitted on the original application page.', dedupeKey: 'application-created' });
  draft.status = 'Applied'; draft.appliedAt = application.appliedAt; draft.applicationId = application._id;
  await draft.save();
  res.status(201).json({ success: true, message: 'Application marked as applied', data: await application.populate('jobId') });
};

exports.run = async (req, res) => {
  const data = await runForUser(req.userId, { user: req.userId });
  res.status(202).json({ success: true, message: data.status === 'PAUSED' ? 'Auto Apply is paused by your settings' : 'Auto Apply scan completed and eligible work was queued', data });
};
exports.status = async (req, res) => {
  const [profile, draftCounts, queueCounts, submittedToday] = await Promise.all([
    Profile.findOne({ userId: req.userId }),
    Draft.aggregate([{ $match: { userId: req.userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    QueueJob.aggregate([{ $match: { userId: req.userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Draft.countDocuments({ userId: req.userId, status: { $in: ['SUBMITTED', 'APPLIED'] }, submittedAt: { $gte: startOfDay(new Date()) } }),
  ]);
  const drafts = Object.fromEntries(draftCounts.map(item => [item._id, item.count]));
  const queue = Object.fromEntries(queueCounts.map(item => [item._id, item.count]));
  const settings = settingsFor(profile);
  const currentStatus = !settings.enabled || !settings.allowAutomaticSubmission ? 'Paused' : queue.PROCESSING ? 'Running' : (drafts.NEEDS_REVIEW || 0) > 0 ? 'Needs Review' : 'Idle';
  res.json({ success: true, data: { enabled: settings.enabled, allowAutomaticSubmission: settings.allowAutomaticSubmission, currentStatus, statistics: { eligibleJobs: 0, queued: queue.QUEUED || 0, processing: queue.PROCESSING || 0, submitted: submittedToday, needsReview: drafts.NEEDS_REVIEW || 0, failed: drafts.FAILED || 0, unsupported: drafts.UNSUPPORTED || 0 } } });
};
exports.queue = async (req, res) => {
  const items = await QueueJob.find({ userId: req.userId }).populate({ path: 'draftId', populate: { path: 'jobId' } }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: items });
};
exports.retry = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const [draft, profile] = await Promise.all([Draft.findOne({ _id: req.params.id, userId: req.userId }).populate('jobId applicationId'), Profile.findOne({ userId: req.userId })]);
  if (!draft) throw httpError(404, 'Application draft not found');
  if (draft.status !== 'FAILED') throw httpError(409, 'Only failed automatic applications can be retried');
  const settings = settingsFor(profile);
  if (!settings.enabled || !settings.allowAutomaticSubmission || !settings.retryFailedApplications) throw httpError(409, 'Automatic retries are disabled');
  if (draft.attemptCount > draft.maxRetries) throw httpError(409, 'Maximum retry count reached');
  draft.status = 'RETRYING'; draft.nextRetryAt = new Date(); draft.failureCode = ''; draft.failureReason = '';
  if (draft.applicationId && ['Failed', 'Needs Review', 'Queued'].includes(draft.applicationId.status)) draft.applicationId.status = 'Queued';
  await Promise.all([draft.save(), draft.applicationId?.save?.(), enqueue({ userId: req.userId, draftId: draft._id, jobId: draft.jobId._id, maxRetries: draft.maxRetries })]);
  res.status(202).json({ success: true, message: 'Retry queued', data: draft });
};
exports.cancel = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const draft = await Draft.findOne({ _id: req.params.id, userId: req.userId }).populate('applicationId');
  if (!draft) throw httpError(404, 'Application draft not found');
  if (['SUBMITTED', 'APPLIED', 'Applied'].includes(draft.status)) throw httpError(409, 'A submitted application cannot be cancelled');
  draft.status = 'CANCELLED'; draft.nextRetryAt = null;
  if (draft.applicationId && ['Prepared', 'Queued', 'Failed', 'Needs Review'].includes(draft.applicationId.status)) draft.applicationId.status = 'Needs Review';
  await Promise.all([draft.save(), draft.applicationId?.save?.(), QueueJob.updateOne({ draftId: draft._id, userId: req.userId }, { $set: { status: 'CANCELLED', lockedAt: null, lockedBy: '', completedAt: new Date() } })]);
  if (draft.applicationId) await createAutoApplyEvent(draft.applicationId._id, 'AUTO_APPLY_NEEDS_REVIEW', 'Auto Apply cancelled', 'auto-apply-cancelled');
  res.json({ success: true, message: 'Automatic application cancelled', data: draft });
};
exports.approve = async (req, res) => {
  validId(req.params.id, 'draft ID');
  const [draft, profile] = await Promise.all([Draft.findOne({ _id: req.params.id, userId: req.userId }).populate('jobId applicationId'), Profile.findOne({ userId: req.userId })]);
  if (!draft) throw httpError(404, 'Application draft not found');
  if (!['NEEDS_REVIEW', 'PREPARED', 'Reviewed'].includes(draft.status)) throw httpError(409, 'This draft is not awaiting approval');
  if (draft.answers.some(answer => answer.required && !String(answer.answer || '').trim())) throw httpError(409, 'Answer every required application question before approval');
  const settings = settingsFor(profile);
  if (!settings.enabled || !settings.allowAutomaticSubmission) throw httpError(409, 'Enable Auto Apply and Automatic Submission before approval');
  draft.status = 'QUEUED'; draft.failureCode = ''; draft.failureReason = ''; draft.nextRetryAt = null;
  if (draft.applicationId && ['Prepared', 'Queued', 'Failed', 'Needs Review'].includes(draft.applicationId.status)) draft.applicationId.status = 'Queued';
  await Promise.all([draft.save(), draft.applicationId?.save?.(), enqueue({ userId: req.userId, draftId: draft._id, jobId: draft.jobId._id, maxRetries: draft.maxRetries })]);
  res.status(202).json({ success: true, message: 'Approved application queued', data: draft });
};

module.exports.eligibleJobs = eligibleJobs;
