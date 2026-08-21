function logAutoApply(event, data = {}) {
  const safe = { event, userId: data.userId, jobId: data.jobId, platform: data.platform, attempt: data.attempt, status: data.status, timestamp: new Date().toISOString() };
  console.log(JSON.stringify(Object.fromEntries(Object.entries(safe).filter(([, value]) => value !== undefined))));
}
module.exports = { logAutoApply };
