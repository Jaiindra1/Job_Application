const crypto = require('crypto');
const Draft = require('../../models/AutoApplyDraft');
const Application = require('../../models/Application');
const Profile = require('../../models/Profile');
const Resume = require('../../models/Resume');
const { generateApplicationPreparation } = require('../ai/aiService');
const { notify } = require('../notificationService');
const { settingsFor } = require('./settingsService');
const queue = require('./autoApplyQueue');
const registry = require('./adapters/adapterRegistry');
const { createAutoApplyEvent } = require('./eventService');
const { logAutoApply } = require('./logger');

const transientCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'RATE_LIMITED', 'ATS_UNAVAILABLE', '502', '503', '504']);
const placeholderAnswer = value => !String(value || '').trim() || /please provide this information|not available|unknown/i.test(String(value));
const backoffMinutes = (base, attempt) => Math.min(base * (3 ** Math.max(attempt - 1, 0)), 24 * 60);
const operationalStatuses = new Set(['Prepared', 'Queued', 'Applied', 'Failed', 'Needs Review']);
const setOperationalStatus = (application, status) => { if (operationalStatuses.has(application.status)) application.status = status; };

async function setNeedsReview({ queueJob, workerId, draft, application, job, code, reason }) {
  draft.status = 'NEEDS_REVIEW'; draft.failureCode = code; draft.failureReason = reason; draft.nextRetryAt = null;
  setOperationalStatus(application, 'Needs Review');
  await Promise.all([draft.save(), application.save(), queue.finish(queueJob._id, workerId, { status: 'COMPLETED', completedAt: new Date(), lastErrorCode: code, lastErrorReason: reason })]);
  await createAutoApplyEvent(application._id, 'AUTO_APPLY_NEEDS_REVIEW', 'Auto Apply needs review', `auto-apply-needs-review:${code}`, { platform: draft.applicationPlatform, failureCode: code });
  await notify(draft.userId, { type: 'AUTO_APPLY_NEEDS_REVIEW', title: 'Auto Apply needs your review', message: `${job.company} — ${job.title} — ${reason}`, relatedApplication: application._id, relatedJob: job._id, dedupeKey: `auto-apply:review:${draft._id}:${code}` });
  logAutoApply('needs_review', { userId: draft.userId, jobId: job._id, platform: draft.applicationPlatform, attempt: draft.attemptCount, status: 'NEEDS_REVIEW' });
  return { status: 'NEEDS_REVIEW' };
}

async function handleFailure({ error, queueJob, workerId, draft, application, job, settings }) {
  const code = String(error.code || error.statusCode || 'SUBMISSION_FAILED');
  const reason = String(error.safeMessage || error.message || 'Automatic submission failed').slice(0, 1000);
  const transient = error.transient === true || transientCodes.has(code) || (['429', '502', '504'].includes(code)) || (code === '503' && !/configur|credential|authoriz/i.test(reason));
  const canRetry = transient && settings.retryFailedApplications && draft.attemptCount <= draft.maxRetries;
  if (canRetry) {
    const nextRetryAt = new Date(Date.now() + backoffMinutes(settings.retryDelayMinutes, draft.attemptCount) * 60000);
    draft.status = 'RETRYING'; draft.failureCode = code; draft.failureReason = reason; draft.nextRetryAt = nextRetryAt;
    await Promise.all([draft.save(), queue.finish(queueJob._id, workerId, { status: 'RETRYING', attemptCount: draft.attemptCount, nextAttemptAt: nextRetryAt, lastErrorCode: code, lastErrorReason: reason })]);
    await createAutoApplyEvent(application._id, 'AUTO_APPLY_RETRYING', 'Auto Apply retry scheduled', `auto-apply-retrying:${draft.attemptCount}`, { attempt: draft.attemptCount, nextRetryAt, failureCode: code });
    logAutoApply('retrying', { userId: draft.userId, jobId: job._id, platform: draft.applicationPlatform, attempt: draft.attemptCount, status: 'RETRYING' });
    return { status: 'RETRYING' };
  }
  draft.status = 'FAILED'; draft.failureCode = code; draft.failureReason = reason; draft.nextRetryAt = null;
  setOperationalStatus(application, 'Failed');
  await Promise.all([draft.save(), application.save(), queue.finish(queueJob._id, workerId, { status: 'FAILED', attemptCount: draft.attemptCount, completedAt: new Date(), lastErrorCode: code, lastErrorReason: reason })]);
  await createAutoApplyEvent(application._id, 'AUTO_APPLY_FAILED', 'Auto Apply failed', `auto-apply-failed:${draft.attemptCount}`, { attempt: draft.attemptCount, failureCode: code });
  await notify(draft.userId, { type: 'AUTO_APPLY_FAILED', title: 'Automatic application failed', message: `${job.company} — ${job.title} — ${reason}`, relatedApplication: application._id, relatedJob: job._id, dedupeKey: `auto-apply:failed:${draft._id}:${draft.attemptCount}` });
  logAutoApply('failed', { userId: draft.userId, jobId: job._id, platform: draft.applicationPlatform, attempt: draft.attemptCount, status: 'FAILED' });
  return { status: 'FAILED' };
}

async function processClaimed(queueJob, workerId) {
  const draft = await Draft.findOne({ _id: queueJob.draftId, userId: queueJob.userId }).populate('jobId').select('+profileSnapshot +resumeSnapshot');
  if (!draft || !draft.jobId) return queue.finish(queueJob._id, workerId, { status: 'FAILED', completedAt: new Date(), lastErrorCode: 'DRAFT_NOT_FOUND', lastErrorReason: 'Draft or job no longer exists.' });
  const job = draft.jobId;
  const application = await Application.findOne({ _id: draft.applicationId, userId: draft.userId, jobId: job._id });
  if (!application) return queue.finish(queueJob._id, workerId, { status: 'FAILED', completedAt: new Date(), lastErrorCode: 'APPLICATION_NOT_FOUND', lastErrorReason: 'Tracked application no longer exists.' });
  const [profile, resume] = await Promise.all([Profile.findOne({ userId: draft.userId }), Resume.findOne({ userId: draft.userId })]);
  const settings = settingsFor(profile);
  if (!settings.enabled || !settings.allowAutomaticSubmission) return setNeedsReview({ queueJob, workerId, draft, application, job, code: 'AUTOMATION_DISABLED', reason: 'Automatic submission was disabled before processing.' });
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const submittedToday = await Draft.countDocuments({ userId: draft.userId, status: { $in: ['SUBMITTED', 'APPLIED'] }, submittedAt: { $gte: dayStart } });
  if (submittedToday >= settings.maximumApplicationsPerDay) {
    const nextAttemptAt = new Date(dayStart); nextAttemptAt.setDate(nextAttemptAt.getDate() + 1);
    draft.status = 'QUEUED'; draft.nextRetryAt = nextAttemptAt;
    await Promise.all([draft.save(), queue.finish(queueJob._id, workerId, { status: 'RETRYING', nextAttemptAt, lastErrorCode: 'DAILY_LIMIT_REACHED', lastErrorReason: 'Daily automatic submission limit reached.' })]);
    return { status: 'QUEUED_DAILY_LIMIT' };
  }
  draft.status = 'PROCESSING'; draft.attemptCount += 1; draft.lastAttemptAt = new Date(); draft.failureCode = ''; draft.failureReason = '';
  setOperationalStatus(application, 'Queued');
  await Promise.all([draft.save(), application.save()]);
  await createAutoApplyEvent(application._id, 'AUTO_APPLY_STARTED', 'Auto Apply started', `auto-apply-started:${draft.attemptCount}`, { attempt: draft.attemptCount, platform: draft.applicationPlatform });
  logAutoApply('started', { userId: draft.userId, jobId: job._id, platform: draft.applicationPlatform, attempt: draft.attemptCount, status: 'PROCESSING' });
  try {
    if ((settings.autoGenerateCoverLetter || settings.autoGenerateAnswers) && (!draft.coverLetter || !draft.answers.length)) {
      const prepared = await generateApplicationPreparation(job, profile, resume, settings);
      draft.coverLetter = prepared.coverLetter;
      draft.answers = prepared.answers.map(answer => ({ ...answer, required: false, source: 'GEMINI_PROFILE_RESUME' }));
      draft.summary = prepared.summary;
      await draft.save();
    }
    if (draft.answers.some(answer => answer.required && placeholderAnswer(answer.answer))) return setNeedsReview({ queueJob, workerId, draft, application, job, code: 'REQUIRED_ANSWER_MISSING', reason: 'Required application question cannot be answered from available profile information.' });
    const adapter = registry.getAdapter({ applicationPlatform: draft.applicationPlatform, originalUrl: draft.applicationUrl });
    if (!adapter) return setNeedsReview({ queueJob, workerId, draft, application, job, code: 'UNSUPPORTED_PLATFORM', reason: 'Application platform is not currently supported.' });
    const form = await adapter.getApplicationForm(job);
    if (form.status === 'NEEDS_REVIEW') return setNeedsReview({ queueJob, workerId, draft, application, job, code: form.failureCode, reason: form.reason });
    const context = await adapter.prepareApplication({ userId: draft.userId, job, profile, resume, draft, form, idempotencyKey: `auto-apply:${draft._id}` });
    let result;
    if (draft.externalApplicationId || application.externalApplicationId) {
      const existingId = draft.externalApplicationId || application.externalApplicationId;
      const existingStatus = await adapter.getSubmissionStatus({ ...context, externalApplicationId: existingId });
      if (existingStatus.verified !== true) return setNeedsReview({ queueJob, workerId, draft, application, job, code: 'SUBMISSION_UNVERIFIED', reason: 'An earlier submission identifier exists but its status could not be verified.' });
      result = { status: 'SUBMITTED', verified: true, externalApplicationId: existingId };
    } else result = await adapter.submitApplication(context);
    if (result.status !== 'SUBMITTED' || result.verified !== true || !String(result.externalApplicationId || '').trim()) {
      return setNeedsReview({ queueJob, workerId, draft, application, job, code: result.failureCode || 'SUBMISSION_UNVERIFIED', reason: result.reason || 'The target system did not verify successful submission.' });
    }
    const confirmation = await adapter.getSubmissionStatus({ ...context, result });
    if (confirmation.verified !== true) return setNeedsReview({ queueJob, workerId, draft, application, job, code: 'SUBMISSION_UNVERIFIED', reason: 'The target system did not confirm successful submission.' });
    const submittedAt = new Date();
    draft.status = 'SUBMITTED'; draft.submittedAt = submittedAt; draft.appliedAt = submittedAt; draft.externalApplicationId = String(result.externalApplicationId); draft.externalStatus = confirmation.status || 'SUBMITTED';
    setOperationalStatus(application, 'Applied'); application.appliedAt = submittedAt; application.submittedAt = submittedAt; application.externalApplicationId = draft.externalApplicationId; application.source = 'AUTO_APPLY'; application.submissionMethod = 'AUTOMATIC';
    await Promise.all([draft.save(), application.save(), queue.finish(queueJob._id, workerId, { status: 'COMPLETED', attemptCount: draft.attemptCount, completedAt: submittedAt })]);
    await createAutoApplyEvent(application._id, 'AUTO_APPLY_SUBMITTED', 'Application submitted automatically', 'auto-apply-submitted', { platform: draft.applicationPlatform, externalApplicationId: draft.externalApplicationId });
    await notify(draft.userId, { type: 'AUTO_APPLY_SUBMITTED', title: 'Application submitted automatically', message: `${job.company} — ${job.title}`, relatedApplication: application._id, relatedJob: job._id, dedupeKey: `auto-apply:submitted:${draft._id}` });
    logAutoApply('submitted', { userId: draft.userId, jobId: job._id, platform: draft.applicationPlatform, attempt: draft.attemptCount, status: 'SUBMITTED' });
    return { status: 'SUBMITTED' };
  } catch (error) {
    return handleFailure({ error, queueJob, workerId, draft, application, job, settings });
  }
}

async function processNext({ workerId = `auto-apply-${crypto.randomUUID()}`, userId } = {}) {
  const claimed = await queue.claimNext({ workerId, userId });
  if (!claimed) return null;
  return processClaimed(claimed, workerId);
}
async function drain({ workerId = `auto-apply-${crypto.randomUUID()}`, userId, limit = 10 } = {}) {
  const results = [];
  while (results.length < limit) {
    const result = await processNext({ workerId, userId });
    if (!result) break;
    results.push(result);
  }
  return results;
}

module.exports = { processNext, processClaimed, drain, backoffMinutes, placeholderAnswer, handleFailure };
