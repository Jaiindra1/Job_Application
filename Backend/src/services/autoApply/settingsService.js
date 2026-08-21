const httpError = require('../../utils/httpError');

const defaults = Object.freeze({
  enabled: false, minimumMatchScore: 85, category: 'IT', categories: ['IT'],
  subcategories: ['FRONTEND', 'FULL_STACK', 'BACKEND', 'SOFTWARE_ENGINEERING'],
  preferredRoles: [], preferredLocations: [], preferredWorkModes: [], workModes: [], excludedCompanies: [], excludedRoles: [],
  maximumApplicationsPerDay: 10, maximumApplicationsPerRun: 5,
  autoGenerateCoverLetter: true, autoGenerateAnswers: true, generateCoverLetter: true, generateAnswers: true,
  allowAutomaticSubmission: false, retryFailedApplications: true, maxRetries: 3, retryDelayMinutes: 5, requireReview: true,
});

const list = value => Array.isArray(value) ? value : [];
function settingsFor(profile) {
  const saved = profile?.autoApplySettings?.toObject?.() || profile?.autoApplySettings || {};
  const preferredRoles = list(saved.preferredRoles).length ? list(saved.preferredRoles) : list(profile?.preferredRoles);
  const preferredLocations = list(saved.preferredLocations).length ? list(saved.preferredLocations) : list(profile?.preferredLocations);
  const preferredWorkModes = list(saved.preferredWorkModes).length ? list(saved.preferredWorkModes) : list(saved.workModes).length ? list(saved.workModes) : list(profile?.workMode);
  const category = saved.category || (list(saved.categories).length === 1 ? saved.categories[0] : 'ALL');
  const categories = category === 'ALL' ? [] : [category];
  const autoGenerateCoverLetter = saved.autoGenerateCoverLetter ?? saved.generateCoverLetter ?? true;
  const autoGenerateAnswers = saved.autoGenerateAnswers ?? saved.generateAnswers ?? true;
  return { ...defaults, ...saved, category, categories, preferredRoles, preferredLocations, preferredWorkModes, workModes: preferredWorkModes, autoGenerateCoverLetter, autoGenerateAnswers, generateCoverLetter: autoGenerateCoverLetter, generateAnswers: autoGenerateAnswers };
}

function cleanList(value, name, max = 30) {
  if (!Array.isArray(value)) throw httpError(400, `${name} must be an array`);
  return [...new Set(value.map(item => String(item).trim()).filter(Boolean))].slice(0, max);
}
function numberInRange(value, name, min, max, fallback) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw httpError(400, `${name} must be between ${min} and ${max}`);
  return Math.round(parsed);
}

function sanitizeSettings(input, current = defaults) {
  const category = String(input.category || (Array.isArray(input.categories) && input.categories.length === 1 ? input.categories[0] : current.category || 'ALL')).toUpperCase();
  if (!['IT', 'NON_IT', 'ALL'].includes(category)) throw httpError(400, 'category must be IT, NON_IT, or ALL');
  const preferredWorkModes = cleanList(input.preferredWorkModes ?? input.workModes ?? current.preferredWorkModes ?? [], 'preferredWorkModes');
  const autoGenerateCoverLetter = input.autoGenerateCoverLetter ?? input.generateCoverLetter ?? current.autoGenerateCoverLetter;
  const autoGenerateAnswers = input.autoGenerateAnswers ?? input.generateAnswers ?? current.autoGenerateAnswers;
  return {
    enabled: input.enabled === undefined ? Boolean(current.enabled) : input.enabled === true,
    minimumMatchScore: numberInRange(input.minimumMatchScore, 'minimumMatchScore', 0, 100, current.minimumMatchScore),
    category, categories: category === 'ALL' ? [] : [category],
    subcategories: cleanList(input.subcategories ?? current.subcategories ?? [], 'subcategories'),
    preferredRoles: cleanList(input.preferredRoles ?? current.preferredRoles ?? [], 'preferredRoles'),
    preferredLocations: cleanList(input.preferredLocations ?? current.preferredLocations ?? [], 'preferredLocations'),
    preferredWorkModes, workModes: preferredWorkModes,
    excludedCompanies: cleanList(input.excludedCompanies ?? current.excludedCompanies ?? [], 'excludedCompanies'),
    excludedRoles: cleanList(input.excludedRoles ?? current.excludedRoles ?? [], 'excludedRoles'),
    maximumApplicationsPerDay: numberInRange(input.maximumApplicationsPerDay, 'maximumApplicationsPerDay', 1, 100, current.maximumApplicationsPerDay),
    maximumApplicationsPerRun: numberInRange(input.maximumApplicationsPerRun, 'maximumApplicationsPerRun', 1, 25, current.maximumApplicationsPerRun),
    autoGenerateCoverLetter: autoGenerateCoverLetter !== false, autoGenerateAnswers: autoGenerateAnswers !== false,
    generateCoverLetter: autoGenerateCoverLetter !== false, generateAnswers: autoGenerateAnswers !== false,
    allowAutomaticSubmission: input.allowAutomaticSubmission === undefined ? Boolean(current.allowAutomaticSubmission) : input.allowAutomaticSubmission === true,
    retryFailedApplications: input.retryFailedApplications === undefined ? current.retryFailedApplications !== false : input.retryFailedApplications === true,
    maxRetries: numberInRange(input.maxRetries, 'maxRetries', 0, 10, current.maxRetries),
    retryDelayMinutes: numberInRange(input.retryDelayMinutes, 'retryDelayMinutes', 1, 1440, current.retryDelayMinutes),
    requireReview: true,
  };
}

module.exports = { defaults, settingsFor, sanitizeSettings };
