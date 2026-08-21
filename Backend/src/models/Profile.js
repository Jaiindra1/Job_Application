const mongoose = require('mongoose');

const autoApplySettings = {
  enabled: { type: Boolean, default: false },
  minimumMatchScore: { type: Number, min: 0, max: 100, default: 85 },
  category: { type: String, enum: ['IT', 'NON_IT', 'ALL'], default: 'IT' },
  categories: { type: [String], default: ['IT'] },
  subcategories: { type: [String], default: ['FRONTEND', 'FULL_STACK', 'BACKEND', 'SOFTWARE_ENGINEERING'] },
  preferredRoles: { type: [String], default: [] },
  preferredLocations: { type: [String], default: [] },
  preferredWorkModes: { type: [String], default: [] },
  workModes: { type: [String], default: [] },
  excludedCompanies: { type: [String], default: [] },
  excludedRoles: { type: [String], default: [] },
  maximumApplicationsPerDay: { type: Number, min: 1, max: 100, default: 10 },
  maximumApplicationsPerRun: { type: Number, min: 1, max: 25, default: 5 },
  autoGenerateCoverLetter: { type: Boolean, default: true },
  autoGenerateAnswers: { type: Boolean, default: true },
  generateCoverLetter: { type: Boolean, default: true },
  generateAnswers: { type: Boolean, default: true },
  allowAutomaticSubmission: { type: Boolean, default: false },
  retryFailedApplications: { type: Boolean, default: true },
  maxRetries: { type: Number, min: 0, max: 10, default: 3 },
  retryDelayMinutes: { type: Number, min: 1, max: 1440, default: 5 },
  requireReview: { type: Boolean, default: true },
};

const schema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, default: '' }, email: { type: String, default: '' }, phone: { type: String, default: '' }, location: { type: String, default: '' },
  summary: { type: String, default: '' }, experience: { type: String, default: '' }, workExperience: { type: [mongoose.Schema.Types.Mixed], default: [] }, currentRole: { type: String, default: '' },
  skills: { type: [String], default: [] }, certifications: { type: [String], default: [] }, jobTitles: { type: [String], default: [] }, technologies: { type: [String], default: [] },
  preferredRoles: { type: [String], default: [] }, preferredLocations: { type: [String], default: [] }, workMode: { type: [String], default: [] }, jobTypes: { type: [String], default: [] }, expectedSalary: { type: String, default: '' },
  education: { type: [mongoose.Schema.Types.Mixed], default: [] }, projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
  autoApplySettings,
  fieldSources: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Profile', schema);
