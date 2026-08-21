require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');
const Event = require('../src/models/ApplicationEvent');
const controller = require('../src/controllers/applicationController');

async function invoke(body, userId) {
  let payload;
  const res = { status() { return this; }, json(value) { payload = value; return this; } };
  await controller.create({ body, userId }, res);
  return payload.data;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const marker = `submission-state-${Date.now()}`;
  const userId = marker;
  const jobIds = [];
  try {
    const common = { company: 'State Test', location: 'Remote', description: 'Application submission-state verification fixture.', source: 'state-test', postedAt: new Date(), staleAt: new Date(Date.now() + 86400000), isActive: true, category: 'IT' };
    const preparedJob = await Job.create({ ...common, title: 'Prepared Test', sourceJobId: `${marker}-prepared`, originalUrl: 'https://example.com/prepared' });
    const appliedJob = await Job.create({ ...common, title: 'Applied Test', sourceJobId: `${marker}-applied`, originalUrl: 'https://example.com/applied' });
    jobIds.push(preparedJob._id, appliedJob._id);
    const prepared = await invoke({ jobId: preparedJob._id }, userId);
    const applied = await invoke({ jobId: appliedJob._id, submissionConfirmed: true }, userId);
    const preparedEvent = await Event.findOne({ applicationId: prepared._id });
    const appliedEvent = await Event.findOne({ applicationId: applied._id });
    const pass = prepared.status === 'Prepared' && prepared.appliedAt === null && preparedEvent.title === 'Application tracked' && applied.status === 'Applied' && Boolean(applied.submittedAt) && /confirmed/.test(appliedEvent.description);
    console.log(`${pass ? 'PASS' : 'FAIL'} | Opening/tracking does not mark Applied; explicit confirmation does`);
    if (!pass) process.exitCode = 1;
  } finally {
    const apps = await Application.find({ userId }).select('_id');
    await Event.deleteMany({ applicationId: { $in: apps.map(item => item._id) } });
    await Application.deleteMany({ userId });
    await Job.deleteMany({ _id: { $in: jobIds } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
