const Profile = require('../../models/Profile');
const Resume = require('../../models/Resume');
const Job = require('../../models/Job');
const Application = require('../../models/Application');
const Draft = require('../../models/AutoApplyDraft');
const { calculateJobMatch } = require('../jobs/jobMatchScoring');
const { refreshJobLifecycle } = require('../jobs/jobLifecycleService');
const { backfillJobClassifications } = require('../jobs/jobClassifier');
const { settingsFor } = require('./settingsService');
const { isEligibleForAutoApply } = require('./eligibilityService');
const { enqueue } = require('./autoApplyQueue');
const { createAutoApplyEvent } = require('./eventService');
const { notify } = require('../notificationService');
const { logAutoApply } = require('./logger');

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const safeProfileSnapshot = profile => ({ name: profile.name, email: profile.email, phone: profile.phone, location: profile.location, skills: profile.skills, technologies: profile.technologies, education: profile.education, certifications: profile.certifications });
const safeResumeSnapshot = resume => ({ resumeId: resume._id, parsedData: resume.parsedData, skills: resume.skills, education: resume.education, projects: resume.projects, parsedAt: resume.parsedAt });

async function ensureApplication(userId, job, draft, status) {
  return Application.findOneAndUpdate({ userId, jobId: job._id }, {
    $setOnInsert: { userId, jobId: job._id, appliedAt: null, source: 'AUTO_APPLY', submissionMethod: 'AUTOMATIC', applicationUrl: job.originalUrl },
    $set: { status, applicationPlatform: draft.applicationPlatform, autoApplyDraftId: draft._id, preparationMetadata: { autoApplyDraftId: draft._id, matchScore: draft.matchScore } },
  }, { returnDocument: "after", upsert: true, runValidators: true });
}

async function recordUnsupported({ userId, job, match, profile, resume, settings, platform, reason }) {
  const draft = await Draft.findOneAndUpdate({ userId, jobId: job._id }, {
    $setOnInsert: { userId, jobId: job._id },
    $set: { status: 'UNSUPPORTED', applicationPlatform: platform, applicationUrl: job.originalUrl, resumeId: resume?._id, matchScore: match.score, matchDetails: match, profileSnapshot: safeProfileSnapshot(profile), resumeSnapshot: safeResumeSnapshot(resume), maxRetries: settings.maxRetries, failureCode: 'UNSUPPORTED_PLATFORM', failureReason: reason },
  }, { returnDocument: "after", upsert: true, runValidators: true });
  const application = await ensureApplication(userId, job, draft, 'Needs Review');
  draft.applicationId = application._id;
  await draft.save();
  await createAutoApplyEvent(application._id, 'AUTO_APPLY_UNSUPPORTED', 'Auto Apply unsupported', 'auto-apply-unsupported', { platform });
  await notify(userId, { type: 'AUTO_APPLY_UNSUPPORTED', title: 'Auto Apply needs your review', message: `${job.company} — ${job.title} — unsupported application platform`, relatedApplication: application._id, relatedJob: job._id, dedupeKey: `auto-apply:unsupported:${draft._id}` });
  logAutoApply('unsupported', { userId, jobId: job._id, platform, status: 'UNSUPPORTED' });
  return draft;
}

async function runForUser(userId, { user = { _id: userId } } = {}) {
  await Promise.all([backfillJobClassifications(Job), refreshJobLifecycle()]);
  const [profile, resume] = await Promise.all([Profile.findOne({ userId }), Resume.findOne({ userId })]);
  const settings = settingsFor(profile);
  if (!settings.enabled || !settings.allowAutomaticSubmission) return { status: 'PAUSED', reasons: [!settings.enabled ? 'AUTO_APPLY_DISABLED' : 'AUTOMATIC_SUBMISSION_DISABLED'], eligible: 0, queued: 0, unsupported: 0 };
  const today = startOfDay(new Date());
  const successfulToday = await Draft.countDocuments({ userId, status: { $in: ['SUBMITTED', 'APPLIED'] }, submittedAt: { $gte: today } });
  if (successfulToday >= settings.maximumApplicationsPerDay) return { status: 'IDLE', reasons: ['DAILY_LIMIT_REACHED'], eligible: 0, queued: 0, unsupported: 0, successfulToday };
  const jobs = await Job.find({ isActive: true, expiredAt: null, staleAt: { $gt: new Date() } }).sort({ postedAt: -1, createdAt: -1 }).limit(250);
  const [applications, drafts] = await Promise.all([Application.find({ userId }).select('jobId status'), Draft.find({ userId }).select('jobId status')]);
  const applicationMap = new Map(applications.map(item => [String(item.jobId), item]));
  const draftMap = new Map(drafts.map(item => [String(item.jobId), item]));
  const summary = { status: 'RUNNING', eligible: 0, queued: 0, unsupported: 0, skipped: 0, successfulToday };
  for (const job of jobs) {
    if (summary.queued + summary.unsupported >= settings.maximumApplicationsPerRun) break;
    const match = calculateJobMatch(job, profile || {}, {});
    const result = isEligibleForAutoApply({ user, job, settings, profile, resume, match, existingApplication: applicationMap.get(String(job._id)), existingDraft: draftMap.get(String(job._id)), successfulToday, mode: 'automatic' });
    const onlyUnsupported = result.reasons.length === 1 && result.reasons[0] === 'UNSUPPORTED_PLATFORM';
    if (!result.eligible && !onlyUnsupported) { summary.skipped += 1; continue; }
    summary.eligible += 1;
    if (onlyUnsupported) {
      await recordUnsupported({ userId, job, match, profile, resume, settings, platform: result.platform, reason: 'Application platform is not currently supported.' });
      summary.unsupported += 1;
      continue;
    }
    let draft;
    try {
      draft = await Draft.create({ userId, jobId: job._id, status: 'QUEUED', applicationPlatform: result.platform, applicationUrl: job.originalUrl, matchScore: match.score, resumeId: resume._id, matchDetails: match, profileSnapshot: safeProfileSnapshot(profile), resumeSnapshot: safeResumeSnapshot(resume), maxRetries: settings.maxRetries });
    } catch (error) {
      if (error.code === 11000) { summary.skipped += 1; continue; }
      throw error;
    }
    const application = await ensureApplication(userId, job, draft, 'Queued');
    draft.applicationId = application._id;
    await draft.save();
    await enqueue({ userId, draftId: draft._id, jobId: job._id, maxRetries: settings.maxRetries });
    await createAutoApplyEvent(application._id, 'AUTO_APPLY_QUEUED', 'Auto Apply queued', 'auto-apply-queued', { platform: result.platform, matchScore: match.score });
    logAutoApply('queued', { userId, jobId: job._id, platform: result.platform, status: 'QUEUED' });
    summary.queued += 1;
  }
  summary.status = summary.queued ? 'RUNNING' : 'IDLE';
  return summary;
}

module.exports = { runForUser, ensureApplication, startOfDay };
