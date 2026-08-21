function inferWorkMode(job) {
  const text = `${job.title || ''} ${job.description || ''} ${job.location?.display_name || ''}`.toLowerCase();
  if (/\bhybrid\b/.test(text)) return 'Hybrid';
  if (/\b(remote|work from home|wfh)\b/.test(text)) return 'Remote';
  if (/\b(on[ -]?site|office based|in office)\b/.test(text)) return 'On-site';
  return 'Unknown';
}

function normalizeJobType(job) {
  if (job.contract_time === 'part_time') return 'Part-time';
  if (job.contract_type === 'contract') return 'Contract';
  if (/intern(ship)?/i.test(`${job.title || ''} ${job.description || ''}`)) return 'Internship';
  if (job.contract_time === 'full_time' || job.contract_type === 'permanent') return 'Full-time';
  return 'Other';
}

function salary(job) {
  if (job.salary_min == null && job.salary_max == null) return '';
  const format = value => value == null ? null : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  const min = format(job.salary_min), max = format(job.salary_max);
  if (min && max) return `₹${min} - ₹${max} per year`;
  return `₹${min || max} per year`;
}

function normalizedSalary(job) {
  if (job.salary_min == null && job.salary_max == null) return {};
  return {salaryMin:Number(job.salary_min??job.salary_max),salaryMax:Number(job.salary_max??job.salary_min),salaryCurrency:'INR',salaryPeriod:'year'};
}

function normalizeAdzunaJob(job) {
  return {
    title: String(job.title || '').trim(),
    company: String(job.company?.display_name || 'Unknown company').trim(),
    location: String(job.location?.display_name || 'Not specified').trim(),
    description: String(job.description || '').trim(),
    skills: [],
    experience: '',
    salary: salary(job),
    ...normalizedSalary(job),
    jobType: normalizeJobType(job),
    workMode: inferWorkMode(job),
    source: 'Adzuna',
    sourceJobId: String(job.id || '').trim(),
    originalUrl: String(job.redirect_url || '').trim(),
    postedAt: job.created ? new Date(job.created) : undefined,
    fetchedAt: new Date(),
    lastSeenAt: new Date(),
    isActive: true,
    expiredAt: null,
  };
}

function normalizeJob(job, source) {
  return { ...job, source, sourceJobId: String(job.sourceJobId || job.id || ''), fetchedAt: new Date() };
}

module.exports = normalizeJob;
module.exports.normalizeAdzunaJob = normalizeAdzunaJob;
