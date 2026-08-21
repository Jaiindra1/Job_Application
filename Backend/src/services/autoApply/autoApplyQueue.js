const crypto = require('crypto');
const QueueJob = require('../../models/AutoApplyQueueJob');

async function enqueue({ userId, draftId, jobId, maxRetries = 3, runAt = new Date() }) {
  return QueueJob.findOneAndUpdate({ draftId }, {
    $setOnInsert: { userId, draftId, jobId, attemptCount: 0 },
    $set: { status: 'QUEUED', maxRetries, nextAttemptAt: runAt, lockedAt: null, lockedBy: '', processingStartedAt: null, lastErrorCode: '', lastErrorReason: '' },
  }, { returnDocument: "after", upsert: true, runValidators: true });
}

async function claimNext({ workerId = `worker-${crypto.randomUUID()}`, staleAfterMs = 10 * 60 * 1000, userId } = {}) {
  const now = new Date();
  const stale = new Date(now.getTime() - staleAfterMs);
  const filter = {
    ...(userId && { userId }),
    status: { $in: ['QUEUED', 'RETRYING', 'PROCESSING'] },
    nextAttemptAt: { $lte: now },
    $or: [{ lockedAt: null }, { lockedAt: { $lt: stale } }],
  };
  return QueueJob.findOneAndUpdate(filter, { $set: { status: 'PROCESSING', lockedAt: now, lockedBy: workerId, processingStartedAt: now } }, { returnDocument: "after", sort: { nextAttemptAt: 1, createdAt: 1 } });
}

async function finish(queueId, workerId, update) {
  return QueueJob.findOneAndUpdate({ _id: queueId, lockedBy: workerId }, { $set: { ...update, lockedAt: null, lockedBy: '' } }, { returnDocument: "after", runValidators: true });
}

module.exports = { enqueue, claimNext, finish };
