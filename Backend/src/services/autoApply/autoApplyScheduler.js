const Profile = require('../../models/Profile');
const { runForUser } = require('./autoApplyEngine');
const { drain } = require('./autoApplyWorker');

let schedulerTimer;
let workerTimer;
let schedulerBusy = false;
let workerBusy = false;

async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const profiles = await Profile.find({ 'autoApplySettings.enabled': true, 'autoApplySettings.allowAutomaticSubmission': true }).select('userId');
    for (const profile of profiles) await runForUser(profile.userId);
  } finally { schedulerBusy = false; }
}
async function workerTick() {
  if (workerBusy) return;
  workerBusy = true;
  try { await drain({ limit: Number(process.env.AUTO_APPLY_WORKER_BATCH_SIZE) || 5 }); }
  finally { workerBusy = false; }
}
function startAutoApplyRuntime() {
  if (process.env.AUTO_APPLY_WORKER_ENABLED === 'false') return;
  const schedulerMs = Math.max(Number(process.env.AUTO_APPLY_SCHEDULER_INTERVAL_MS) || 1800000, 60000);
  const workerMs = Math.max(Number(process.env.AUTO_APPLY_WORKER_INTERVAL_MS) || 10000, 1000);
  schedulerTimer = setInterval(() => schedulerTick().catch(error => console.error('Auto Apply scheduler error:', error.message)), schedulerMs);
  workerTimer = setInterval(() => workerTick().catch(error => console.error('Auto Apply worker error:', error.message)), workerMs);
  schedulerTimer.unref(); workerTimer.unref();
  setImmediate(() => workerTick().catch(error => console.error('Auto Apply worker error:', error.message)));
}
function stopAutoApplyRuntime() { clearInterval(schedulerTimer); clearInterval(workerTimer); schedulerTimer = null; workerTimer = null; }

module.exports = { startAutoApplyRuntime, stopAutoApplyRuntime, schedulerTick, workerTick };
