require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const mongoose = require('mongoose');
const { signToken } = require('../src/middleware/auth');
const User = require('../src/models/User');
const Profile = require('../src/models/Profile');
const Resume = require('../src/models/Resume');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');
const Draft = require('../src/models/AutoApplyDraft');
const QueueJob = require('../src/models/AutoApplyQueueJob');
const Event = require('../src/models/ApplicationEvent');
const Notification = require('../src/models/Notification');
const { claimNext } = require('../src/services/autoApply/autoApplyQueue');
const { processNext, handleFailure } = require('../src/services/autoApply/autoApplyWorker');

const base = process.env.AUTO_APPLY_TEST_API || 'http://127.0.0.1:7010/api';
const results = [];
const record = (name, pass, detail = '') => results.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
async function request(path, token, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body && { 'Content-Type': 'application/json' }) } });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const marker = `auto-engine-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const userIds = [];
  const jobIds = [];
  try {
    const user = await User.create({ name: 'Auto Engine Test', email: `${marker}@example.test`, passwordHash: crypto.randomBytes(32).toString('hex') });
    const other = await User.create({ name: 'Isolation Test', email: `${marker}-other@example.test`, passwordHash: crypto.randomBytes(32).toString('hex') });
    userIds.push(String(user._id), String(other._id));
    const token = signToken(String(user._id));
    const otherToken = signToken(String(other._id));
    const future = new Date(Date.now() + 7 * 86400000);
    await Profile.create({ userId: String(user._id), name: 'Auto Engine Test', email: `${marker}@example.test`, skills: ['React', 'JavaScript'], preferredRoles: ['AutoApply Verification'], autoApplySettings: { enabled: false, allowAutomaticSubmission: false, minimumMatchScore: 0, category: 'IT', subcategories: [], preferredRoles: ['AutoApply Verification'], preferredLocations: [], preferredWorkModes: [], maximumApplicationsPerDay: 10, maximumApplicationsPerRun: 5, autoGenerateCoverLetter: false, autoGenerateAnswers: false, retryFailedApplications: true, maxRetries: 3, retryDelayMinutes: 5 } });
    await Profile.create({ userId: String(other._id), name: 'Isolation Test', email: `${marker}-other@example.test` });
    await Resume.create({ userId: String(user._id), fileName: 'test.pdf', extractionStatus: 'completed', extractedText: 'React and JavaScript developer.', parsingStatus: 'completed', parsedData: { skills: ['React', 'JavaScript'] }, skills: ['React', 'JavaScript'] });
    const common = { company: 'Verification Company', location: 'Remote', description: 'Build and maintain React applications using JavaScript with a collaborative software engineering team and tested delivery practices.', skills: ['React', 'JavaScript'], jobType: 'Full-time', workMode: 'Remote', source: 'auto-engine-test', postedAt: new Date(), fetchedAt: new Date(), lastSeenAt: new Date(), staleAt: future, expiredAt: null, isActive: true, category: 'IT', subcategory: 'FRONTEND', categoryConfidence: 1, classificationVersion: 'test' };
    const known = await Job.create({ ...common, title: 'AutoApply Verification Greenhouse', sourceJobId: `${marker}-known`, originalUrl: `https://boards.greenhouse.io/${marker}/jobs/1` });
    const unknown = await Job.create({ ...common, title: 'AutoApply Verification Unknown', sourceJobId: `${marker}-unknown`, originalUrl: `https://example.com/${marker}/jobs/2`, postedAt: new Date(Date.now() - 1000) });
    const expired = await Job.create({ ...common, title: 'AutoApply Verification Expired', sourceJobId: `${marker}-expired`, originalUrl: `https://jobs.lever.co/${marker}/3`, isActive: false, expiredAt: new Date(), postedAt: new Date(Date.now() - 2000) });
    jobIds.push(known._id, unknown._id, expired._id);

    let response = await request('/auto-apply/run', token, { method: 'POST' });
    record('Auto Apply disabled', response.response.status === 202 && response.payload.data?.reasons?.includes('AUTO_APPLY_DISABLED'));
    record('Disabled creates no drafts', await Draft.countDocuments({ userId: String(user._id) }) === 0);

    let settings = { enabled: true, allowAutomaticSubmission: false, minimumMatchScore: 0, category: 'IT', subcategories: [], preferredRoles: ['AutoApply Verification'], preferredLocations: [], preferredWorkModes: [], excludedCompanies: [], excludedRoles: [], maximumApplicationsPerDay: 10, maximumApplicationsPerRun: 5, autoGenerateCoverLetter: false, autoGenerateAnswers: false, retryFailedApplications: true, maxRetries: 3, retryDelayMinutes: 5 };
    response = await request('/auto-apply/settings', token, { method: 'PUT', body: JSON.stringify(settings) });
    record('Auto Apply enabled', response.response.status === 200 && response.payload.data?.enabled === true);
    response = await request('/auto-apply/run', token, { method: 'POST' });
    record('Automatic submission disabled', response.payload.data?.reasons?.includes('AUTOMATIC_SUBMISSION_DISABLED'));

    settings = { ...settings, allowAutomaticSubmission: true, minimumMatchScore: 100 };
    await request('/auto-apply/settings', token, { method: 'PUT', body: JSON.stringify(settings) });
    response = await request('/auto-apply/run', token, { method: 'POST' });
    record('Minimum match score', response.payload.data?.queued === 0 && response.payload.data?.unsupported === 0);

    settings = { ...settings, minimumMatchScore: 0 };
    await request('/auto-apply/settings', token, { method: 'PUT', body: JSON.stringify(settings) });
    response = await request('/auto-apply/run', token, { method: 'POST' });
    record('Queue creation', response.response.status === 202 && response.payload.data?.queued === 1, JSON.stringify(response.payload.data));
    record('Unsupported ATS', response.payload.data?.unsupported === 1 && Boolean(await Draft.exists({ userId: String(user._id), jobId: unknown._id, status: 'UNSUPPORTED' })));
    record('Expired job rejection', !(await Draft.exists({ userId: String(user._id), jobId: expired._id })));
    const knownDraft = await Draft.findOne({ userId: String(user._id), jobId: known._id });
    record('Application creation as non-applied', Boolean(await Application.exists({ userId: String(user._id), jobId: known._id, status: 'Queued' })));
    response = await request('/auto-apply/run', token, { method: 'POST' });
    record('Duplicate draft prevention', await Draft.countDocuments({ userId: String(user._id), jobId: known._id }) === 1);

    const [claimOne, claimTwo] = await Promise.all([claimNext({ workerId: `${marker}-worker-1`, userId: String(user._id) }), claimNext({ workerId: `${marker}-worker-2`, userId: String(user._id) })]);
    record('Concurrent worker protection', [claimOne, claimTwo].filter(Boolean).length === 1);
    const claimed = claimOne || claimTwo;
    await QueueJob.updateOne({ _id: claimed._id }, { $set: { status: 'QUEUED', lockedAt: null, lockedBy: '', nextAttemptAt: new Date() } });
    knownDraft.coverLetter = 'Verified test preparation'; knownDraft.answers = [{ question: 'Name', answer: 'Auto Engine Test', required: false, source: 'PROFILE' }]; await knownDraft.save();
    const workerResult = await processNext({ workerId: `${marker}-worker`, userId: String(user._id) });
    record('Worker processing', workerResult?.status === 'NEEDS_REVIEW');
    record('Known ATS interactive safety', Boolean(await Draft.exists({ _id: knownDraft._id, status: 'NEEDS_REVIEW', failureCode: 'INTERACTIVE_FORM_REQUIRED' })));
    record('No fabricated successful submission', !(await Application.exists({ userId: String(user._id), jobId: known._id, status: 'Applied' })));
    record('Needs-review event', Boolean(await Event.exists({ applicationId: knownDraft.applicationId, type: 'AUTO_APPLY_NEEDS_REVIEW' })));
    record('Needs-review notification', Boolean(await Notification.exists({ userId: String(user._id), type: 'AUTO_APPLY_NEEDS_REVIEW' })));

    response = await request(`/auto-apply/${knownDraft._id}`, otherToken);
    record('User isolation', response.response.status === 404);
    response = await request('/auto-apply/not-an-object-id', token);
    record('Invalid ObjectId', response.response.status === 400);

    await QueueJob.updateOne({ draftId: knownDraft._id }, { $set: { status: 'QUEUED', nextAttemptAt: new Date(), lockedAt: new Date(), lockedBy: `${marker}-failure` } });
    const failureDraft = await Draft.findById(knownDraft._id);
    const failureApplication = await Application.findById(failureDraft.applicationId);
    const failureQueue = await QueueJob.findOne({ draftId: knownDraft._id });
    const permanentError = new Error('Permanent target validation failure'); permanentError.code = 'PERMANENT_VALIDATION';
    const failureResult = await handleFailure({ error: permanentError, queueJob: failureQueue, workerId: `${marker}-failure`, draft: failureDraft, application: failureApplication, job: known, settings });
    record('Failed submission handling', failureResult.status === 'FAILED' && Boolean(await Draft.exists({ _id: knownDraft._id, status: 'FAILED' })));
    response = await request(`/auto-apply/${knownDraft._id}/retry`, token, { method: 'POST' });
    record('Retry', response.response.status === 202 && Boolean(await QueueJob.exists({ draftId: knownDraft._id, status: 'QUEUED' })));
    response = await request(`/auto-apply/${knownDraft._id}/cancel`, token, { method: 'POST' });
    record('Cancel', response.response.status === 200 && Boolean(await Draft.exists({ _id: knownDraft._id, status: 'CANCELLED' })));

    const submittedMarker = await Draft.create({ userId: String(user._id), jobId: expired._id, status: 'SUBMITTED', applicationPlatform: 'LEVER', applicationUrl: expired.originalUrl, matchScore: 100, submittedAt: new Date(), externalApplicationId: `${marker}-external` });
    settings = { ...settings, maximumApplicationsPerDay: 1 };
    await request('/auto-apply/settings', token, { method: 'PUT', body: JSON.stringify(settings) });
    response = await request('/auto-apply/run', token, { method: 'POST' });
    record('Daily limit', response.payload.data?.reasons?.includes('DAILY_LIMIT_REACHED'));
    await Draft.deleteOne({ _id: submittedMarker._id });

    response = await request('/auto-apply/status', token);
    record('Status endpoint', response.response.status === 200 && response.payload.data?.statistics);
    response = await request('/auto-apply/queue', token);
    record('Queue endpoint', response.response.status === 200 && Array.isArray(response.payload.data));
    response = await request('/auto-apply/history', token);
    record('History endpoint', response.response.status === 200 && Array.isArray(response.payload.data));
  } finally {
    const scopedUsers = userIds;
    const applications = await Application.find({ userId: { $in: scopedUsers } }).select('_id');
    await Promise.all([
      Event.deleteMany({ applicationId: { $in: applications.map(item => item._id) } }),
      Notification.deleteMany({ userId: { $in: scopedUsers } }),
      QueueJob.deleteMany({ userId: { $in: scopedUsers } }),
      Draft.deleteMany({ userId: { $in: scopedUsers } }),
      Application.deleteMany({ userId: { $in: scopedUsers } }),
      Resume.deleteMany({ userId: { $in: scopedUsers } }),
      Profile.deleteMany({ userId: { $in: scopedUsers } }),
      User.deleteMany({ _id: { $in: scopedUsers.filter(mongoose.isValidObjectId) } }),
      Job.deleteMany({ _id: { $in: jobIds } }),
    ]);
  }
  for (const result of results) console.log(`${result.status} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
  const failed = results.filter(result => result.status === 'FAIL');
  console.log(`SUMMARY | ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
