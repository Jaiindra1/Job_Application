const httpError = require('../../utils/httpError');

const BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

async function searchAdzunaJobs({ page = 1, what = '', where = '', resultsPerPage = 10 } = {}) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = (process.env.ADZUNA_COUNTRY || 'in').toLowerCase();

  if (!appId || !appKey) throw httpError(503, 'Adzuna credentials are not configured');

  const url = new URL(`${BASE_URL}/${encodeURIComponent(country)}/search/${page}`);
  url.search = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what,
    where,
    results_per_page: String(resultsPerPage),
    'content-type': 'json',
  });

  console.log('Adzuna request started');
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    if (error.name === 'TimeoutError') throw httpError(504, 'Adzuna request timed out. Please try again.');
    throw httpError(502, 'Unable to connect to Adzuna. Please try again.');
  }

  if (response.status === 429) throw httpError(429, 'Adzuna rate limit reached. Please try again later.');
  if (response.status === 401 || response.status === 403) throw httpError(502, 'Adzuna rejected the configured credentials');
  if (!response.ok) throw httpError(502, `Adzuna request failed with status ${response.status}`);

  let payload;
  try { payload = await response.json(); }
  catch { throw httpError(502, 'Adzuna returned an invalid response'); }

  const results = Array.isArray(payload.results) ? payload.results : [];
  console.log(`Adzuna returned ${results.length} jobs`);
  return { count: Number(payload.count) || results.length, results };
}

module.exports = { searchAdzunaJobs };
