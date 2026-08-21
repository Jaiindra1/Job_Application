const Job = require('../models/Job');
const httpError = require('../utils/httpError');
const { searchAdzunaJobs } = require('../services/jobs/adzunaService');
const { normalizeAdzunaJob } = require('../services/jobs/jobNormalizer');
const { classifyJob } = require('../services/jobs/jobClassifier');

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const importAttempts=new Map();

exports.importJobs = async (req, res) => {
  const { what = '', where = '' } = req.body || {};
  const page = req.body?.page == null ? 1 : Number(req.body.page);
  const resultsPerPage = req.body?.resultsPerPage == null ? 20 : Number(req.body.resultsPerPage);
  const maxPages = req.body?.maxPages == null ? 5 : Number(req.body.maxPages);

  if (typeof what !== 'string' || typeof where !== 'string') throw httpError(400, 'what and where must be strings');
  if (!Number.isInteger(page) || page < 1) throw httpError(400, 'page must be a positive integer');
  if (!Number.isInteger(resultsPerPage) || resultsPerPage < 1 || resultsPerPage > 20) throw httpError(400, 'resultsPerPage must be between 1 and 20');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 5) throw httpError(400, 'maxPages must be between 1 and 5');
  if (what.length > 200 || where.length > 120) throw httpError(400, 'Search parameters are too long');

  const freshnessHours = Math.min(Math.max(Number(process.env.ADZUNA_FRESHNESS_HOURS) || 6, 1), 72);
  const recentFilter = { source: 'Adzuna', isActive:true, expiredAt:null, staleAt:{$gt:new Date()}, fetchedAt: { $gte: new Date(Date.now() - freshnessHours * 3600000) } };
  if (what.trim()) {
    const search = new RegExp(escapeRegex(what.trim()), 'i');
    recentFilter.$or = [{ title: search }, { description: search }, { company: search }];
  }
  if (where.trim()) recentFilter.location = new RegExp(escapeRegex(where.trim()), 'i');
  const freshJobs = await Job.countDocuments(recentFilter);
  if (freshJobs > 0) {
    return res.status(200).json({
      success: true,
      message: 'Recent Adzuna jobs are already available',
      data: { provider: 'Adzuna', search: { what: what.trim(), where: where.trim(), page, resultsPerPage, maxPages }, received: 0, inserted: 0, updated: 0, duplicates: 0, skipped: 0, pagesFetched: 0, cached: true, freshJobs, freshnessHours },
    });
  }

  const cooldownMs=Math.max(5000,Math.min(Number(process.env.ADZUNA_IMPORT_COOLDOWN_MS)||30000,300000)),lastAttempt=importAttempts.get(req.userId)||0;
  if(Date.now()-lastAttempt<cooldownMs)throw httpError(429,'Adzuna import was requested too recently. Please try again later.');
  importAttempts.set(req.userId,Date.now());

  const providerResults=[];let pagesFetched=0;
  for(let offset=0;offset<maxPages;offset+=1){
    let provider;
    try{provider=await searchAdzunaJobs({page:page+offset,what:what.trim(),where:where.trim(),resultsPerPage})}catch(error){if(error.statusCode===429&&pagesFetched>0)break;throw error}
    pagesFetched+=1;providerResults.push(...provider.results);
    if(provider.results.length===0||provider.results.length<resultsPerPage||(page+offset)*resultsPerPage>=provider.count)break;
  }
  const staleHours=Math.min(Math.max(Number(process.env.JOB_STALE_HOURS)||48,1),720),seenAt=new Date();
  const valid = providerResults.map(normalizeAdzunaJob).map(job=>({...job,...classifyJob(job),lastSeenAt:seenAt,staleAt:new Date(seenAt.getTime()+staleHours*3600000),isActive:true,expiredAt:null})).filter(job =>
    job.sourceJobId &&
    job.title &&
    job.originalUrl &&
    job.postedAt instanceof Date &&
    !Number.isNaN(job.postedAt.getTime())
  );
  const normalized=[...new Map(valid.map(job=>[`${job.source}:${job.sourceJobId}`,job])).values()];
  const providerDuplicates=valid.length-normalized.length,skipped=providerResults.length-valid.length;

  let result = { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
  if (normalized.length) {
    result = await Job.bulkWrite(normalized.map(job => ({
      updateOne: {
        filter: { source: job.source, sourceJobId: job.sourceJobId },
        update: { $set: job },
        upsert: true,
      },
    })), { ordered: false });
  }

  const inserted = result.upsertedCount || 0;
  const updated = result.modifiedCount || 0;
  const duplicates = providerDuplicates+Math.max((result.matchedCount || 0) - updated, 0);
  console.log(`${inserted} jobs inserted`);
  console.log(`${updated} jobs updated`);

  res.status(200).json({
    success: true,
    message: 'Adzuna jobs imported successfully',
    data: {
      provider: 'Adzuna',
      search: { what: what.trim(), where: where.trim(), page, resultsPerPage, maxPages },
      received: providerResults.length,
      inserted,
      updated,
      duplicates,
      skipped,
      pagesFetched,
      cached: false,
      freshnessHours,
    },
  });
};
