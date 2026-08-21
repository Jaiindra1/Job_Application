const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutoApplyDraft', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED'], default: 'QUEUED', index: true },
  attemptCount: { type: Number, min: 0, default: 0 },
  maxRetries: { type: Number, min: 0, max: 10, default: 3 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedAt: { type: Date, default: null, index: true },
  lockedBy: { type: String, default: '' },
  processingStartedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastErrorCode: { type: String, default: '' },
  lastErrorReason: { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });

schema.index({ draftId: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, lockedAt: 1 });
schema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AutoApplyQueueJob', schema);
