const { detectApplicationPlatform } = require('./platformDetector');

const activeDraftStatuses = new Set(['PREPARED', 'QUEUED', 'PROCESSING', 'RETRYING', 'SUBMITTED', 'APPLIED', 'Draft', 'Prepared', 'Reviewed', 'Applied']);
const includesPreference = (values, text) => !values.length || values.some(value => String(text || '').toLowerCase().includes(String(value).toLowerCase()));
const matchesExact = (values, text) => !values.length || values.some(value => String(value).toLowerCase() === String(text || '').toLowerCase());
const validUrl = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };

function isEligibleForAutoApply({ user, job, settings, profile, resume, match, existingApplication = null, existingDraft = null, successfulToday = 0, mode = 'automatic', now = new Date() }) {
  const reasons = [];
  const score = Number(match?.score || 0);
  const platform = detectApplicationPlatform(job?.originalUrl);
  if (!user) reasons.push('UNAUTHENTICATED');
  if (mode === 'automatic' && !settings?.enabled) reasons.push('AUTO_APPLY_DISABLED');
  if (mode === 'automatic' && !settings?.allowAutomaticSubmission) reasons.push('AUTOMATIC_SUBMISSION_DISABLED');
  if (!job) reasons.push('JOB_NOT_FOUND');
  if (job && (!job.isActive || job.expiredAt || (job.staleAt && new Date(job.staleAt) <= now))) reasons.push('JOB_INACTIVE_OR_EXPIRED');
  if (job && !validUrl(job.originalUrl)) reasons.push('INVALID_APPLICATION_URL');
  if (job && settings?.category && settings.category !== 'ALL' && job.category !== settings.category) reasons.push('CATEGORY_MISMATCH');
  if (job && settings?.subcategories?.length && !settings.subcategories.includes(job.subcategory)) reasons.push('SUBCATEGORY_MISMATCH');
  if (job && !includesPreference(settings?.preferredRoles || [], job.title)) reasons.push('ROLE_MISMATCH');
  if (job && !includesPreference(settings?.preferredLocations || [], job.location)) reasons.push('LOCATION_MISMATCH');
  if (job && !matchesExact(settings?.preferredWorkModes || [], job.workMode)) reasons.push('WORK_MODE_MISMATCH');
  if (job && includesPreference(settings?.excludedCompanies || [], job.company) && (settings?.excludedCompanies || []).length) reasons.push('COMPANY_EXCLUDED');
  if (job && includesPreference(settings?.excludedRoles || [], job.title) && (settings?.excludedRoles || []).length) reasons.push('ROLE_EXCLUDED');
  if (score < Number(settings?.minimumMatchScore || 0)) reasons.push('LOW_MATCH_SCORE');
  if (existingApplication) reasons.push('ALREADY_APPLIED_OR_TRACKED');
  if (mode === 'automatic' && existingDraft && activeDraftStatuses.has(existingDraft.status)) reasons.push('ACTIVE_DRAFT_EXISTS');
  if (mode === 'automatic' && successfulToday >= Number(settings?.maximumApplicationsPerDay || 1)) reasons.push('DAILY_LIMIT_REACHED');
  if (job && String(job.description || '').trim().length < 80) reasons.push('INSUFFICIENT_JOB_DETAILS');
  if (!profile || !String(profile.name || '').trim() || !String(profile.email || '').trim()) reasons.push('PROFILE_INCOMPLETE');
  if (!resume || resume.extractionStatus !== 'completed' || !String(resume.extractedText || '').trim()) reasons.push('RESUME_REQUIRED');
  if (mode === 'automatic' && platform === 'UNKNOWN') reasons.push('UNSUPPORTED_PLATFORM');
  return { eligible: reasons.length === 0, reasons, score, platform };
}

module.exports = { isEligibleForAutoApply, activeDraftStatuses, validUrl };
