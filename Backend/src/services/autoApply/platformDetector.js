const PLATFORM_RULES = [
  ['GREENHOUSE', host => ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(host) || host.endsWith('.greenhouse.io')],
  ['LEVER', host => ['jobs.lever.co', 'api.lever.co'].includes(host) || host.endsWith('.lever.co')],
  ['WORKDAY', host => host === 'myworkdayjobs.com' || host.endsWith('.myworkdayjobs.com') || host.endsWith('.myworkday.com')],
  ['SMARTRECRUITERS', host => host === 'jobs.smartrecruiters.com' || host.endsWith('.smartrecruiters.com')],
  ['ASHBY', host => host === 'jobs.ashbyhq.com' || host.endsWith('.ashbyhq.com')],
  ['ICIMS', host => host === 'icims.com' || host.endsWith('.icims.com')],
  ['DARWINBOX', host => host === 'darwinbox.in' || host.endsWith('.darwinbox.in') || host.endsWith('.darwinbox.com')],
  ['SUCCESSFACTORS', host => host === 'successfactors.com' || host.endsWith('.successfactors.com') || host.endsWith('.successfactors.eu')],
  ['ADP', host => host === 'workforcenow.adp.com' || host === 'recruiting.adp.com' || host.endsWith('.adp.com')],
];

function detectApplicationPlatform(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return 'UNKNOWN';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return PLATFORM_RULES.find(([, matches]) => matches(host))?.[0] || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

module.exports = { detectApplicationPlatform, PLATFORM_RULES };
