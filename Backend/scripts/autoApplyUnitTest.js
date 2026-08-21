const assert = require('assert');
const { detectApplicationPlatform } = require('../src/services/autoApply/platformDetector');
const { isEligibleForAutoApply } = require('../src/services/autoApply/eligibilityService');
const { sanitizeSettings, defaults } = require('../src/services/autoApply/settingsService');
const { backoffMinutes, placeholderAnswer } = require('../src/services/autoApply/autoApplyWorker');
const { _test: gmailTracking } = require('../src/services/gmailService');

const settings = sanitizeSettings({ enabled: true, allowAutomaticSubmission: true, minimumMatchScore: 80, category: 'IT', subcategories: [], preferredRoles: [], preferredLocations: [], preferredWorkModes: [], excludedCompanies: [], excludedRoles: [], maximumApplicationsPerDay: 2, maximumApplicationsPerRun: 1, autoGenerateCoverLetter: true, autoGenerateAnswers: true, retryFailedApplications: true, maxRetries: 3, retryDelayMinutes: 5 }, defaults);
const base = {
  user: 'authenticated-user',
  job: { isActive: true, expiredAt: null, staleAt: new Date(Date.now() + 60000), originalUrl: 'https://boards.greenhouse.io/acme/jobs/1', category: 'IT', subcategory: 'FRONTEND', title: 'React Developer', company: 'Acme', location: 'Remote', workMode: 'Remote', description: 'A'.repeat(100) },
  settings,
  profile: { name: 'User', email: 'user@example.com' },
  resume: { extractionStatus: 'completed', extractedText: 'Verified resume text' },
  match: { score: 90 },
};

assert(isEligibleForAutoApply(base).eligible);
assert(!isEligibleForAutoApply({ ...base, settings: { ...settings, enabled: false } }).eligible);
assert(!isEligibleForAutoApply({ ...base, settings: { ...settings, allowAutomaticSubmission: false } }).eligible);
assert(!isEligibleForAutoApply({ ...base, match: { score: 50 } }).eligible);
assert(!isEligibleForAutoApply({ ...base, settings: { ...settings, category: 'NON_IT' } }).eligible);
assert(!isEligibleForAutoApply({ ...base, existingApplication: { _id: 'existing' } }).eligible);
assert(!isEligibleForAutoApply({ ...base, existingDraft: { status: 'QUEUED' } }).eligible);
assert(!isEligibleForAutoApply({ ...base, job: { ...base.job, expiredAt: new Date() } }).eligible);
assert(!isEligibleForAutoApply({ ...base, successfulToday: 2 }).eligible);
assert(!isEligibleForAutoApply({ ...base, profile: null }).eligible);
assert(!isEligibleForAutoApply({ ...base, resume: null }).eligible);
assert(!isEligibleForAutoApply({ ...base, job: { ...base.job, originalUrl: 'https://example.com/job' } }).eligible);
assert(placeholderAnswer('Please provide this information.'));
assert.equal(backoffMinutes(5, 1), 5);
assert.equal(backoffMinutes(5, 2), 15);
assert.equal(backoffMinutes(5, 3), 45);
assert.equal(detectApplicationPlatform('https://jobs.lever.co/acme/1'), 'LEVER');
assert.equal(detectApplicationPlatform('https://acme.wd5.myworkdayjobs.com/job/1'), 'WORKDAY');
assert.equal(detectApplicationPlatform('https://jobs.smartrecruiters.com/acme/1'), 'SMARTRECRUITERS');
assert.equal(detectApplicationPlatform('https://jobs.ashbyhq.com/acme/1'), 'ASHBY');
assert.equal(detectApplicationPlatform('https://careers-acme.icims.com/jobs/1'), 'ICIMS');
assert.equal(detectApplicationPlatform('https://acme.darwinbox.in/ms/candidate/1'), 'DARWINBOX');
assert.equal(detectApplicationPlatform('https://career5.successfactors.eu/job/1'), 'SUCCESSFACTORS');
assert.equal(detectApplicationPlatform('https://workforcenow.adp.com/jobs/1'), 'ADP');
for (const advanced of ['Assessment', 'Interview', 'Offer', 'Rejected', 'Withdrawn']) assert(!gmailTracking.canAdvanceStatus(advanced, 'Application Received'));

console.log('PASS | Auto Apply deterministic unit checks');
