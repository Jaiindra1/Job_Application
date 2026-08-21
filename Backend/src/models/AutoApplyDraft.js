const mongoose = require('mongoose');

const statuses = [
  'PREPARED', 'QUEUED', 'PROCESSING', 'SUBMITTED', 'APPLIED', 'FAILED', 'RETRYING',
  'UNSUPPORTED', 'NEEDS_REVIEW', 'CANCELLED',
  // Legacy values remain readable for backward compatibility.
  'Draft', 'Prepared', 'Reviewed', 'Applied',
];
const platforms = ['GREENHOUSE', 'LEVER', 'WORKDAY', 'SMARTRECRUITERS', 'ASHBY', 'ICIMS', 'DARWINBOX', 'SUCCESSFACTORS', 'ADP', 'UNKNOWN'];

const schema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  status: { type: String, enum: statuses, default: 'PREPARED', index: true },
  applicationPlatform: { type: String, enum: platforms, default: 'UNKNOWN', index: true },
  applicationUrl: { type: String, default: '' },
  matchScore: { type: Number, min: 0, max: 100, required: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
  coverLetter: { type: String, default: '', maxlength: 20000 },
  answers: { type: [{ question: { type: String, required: true }, answer: { type: String, default: '' }, required: { type: Boolean, default: false }, source: { type: String, default: '' } }], default: [] },
  summary: { type: String, default: '', maxlength: 4000 },
  matchDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  profileSnapshot: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },
  resumeSnapshot: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },
  coverLetterDraftId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoverLetterDraft', default: null },
  attemptCount: { type: Number, min: 0, default: 0 },
  maxRetries: { type: Number, min: 0, max: 10, default: 3 },
  lastAttemptAt: { type: Date, default: null },
  nextRetryAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  failureReason: { type: String, default: '', maxlength: 1000 },
  failureCode: { type: String, default: '', maxlength: 100 },
  externalApplicationId: { type: String, default: '', maxlength: 500 },
  externalStatus: { type: String, default: '', maxlength: 100 },
  reviewedAt: { type: Date, default: null },
  appliedAt: { type: Date, default: null },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
}, { timestamps: true });

schema.index({ userId: 1, jobId: 1 }, { unique: true });
schema.index({ userId: 1, status: 1, submittedAt: -1 });
schema.index({ externalApplicationId: 1 }, { unique: true, partialFilterExpression: { externalApplicationId: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('AutoApplyDraft', schema);
