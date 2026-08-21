const crypto = require('crypto');
const GmailConnection = require('../models/GmailConnection');
const GmailMessage = require('../models/GmailMessage');
const Application = require('../models/Application');
const ApplicationEvent = require('../models/ApplicationEvent');
const { notify } = require('./notificationService');
const httpError = require('../utils/httpError');

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const DEFAULT_SYNC_QUERY = 'newer_than:90d {"application received" "thank you for applying" "thanks for applying" "your application" "application confirmation" "application submitted" "job application" applied assessment interview recruiter offer rejection hiring candidate}';
const requiredConfig = () => {
  const config = { clientId: process.env.GMAIL_CLIENT_ID, clientSecret: process.env.GMAIL_CLIENT_SECRET, redirectUri: process.env.GMAIL_REDIRECT_URI };
  if (!config.clientId || !config.clientSecret || !config.redirectUri) throw httpError(503, 'Gmail OAuth is not configured');
  return config;
};
const encryptionKey = () => {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw httpError(503, 'Gmail token encryption is not configured');
  return crypto.createHash('sha256').update(secret).digest();
};
const encrypt = value => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
};
const decrypt = value => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8');
};
const stateSecret = () => process.env.GMAIL_OAUTH_STATE_SECRET || process.env.JWT_SECRET;

function createState(userId) {
  if (!stateSecret()) throw httpError(503, 'Gmail OAuth state signing is not configured');
  const payload = Buffer.from(JSON.stringify({ sub: userId, nonce: crypto.randomBytes(16).toString('hex'), exp: Date.now() + 600000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyState(state) {
  try {
    const [payload, signature] = String(state || '').split('.');
    const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest();
    const actual = Buffer.from(signature || '', 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error();
    const data = JSON.parse(Buffer.from(payload, 'base64url'));
    if (!data.sub || data.exp < Date.now()) throw new Error();
    return data.sub;
  } catch {
    throw httpError(400, 'Invalid or expired Gmail OAuth state');
  }
}

function authorizationUrl(userId) {
  const { clientId, redirectUri } = requiredConfig();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE, access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent', state: createState(userId) });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function googleRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  } catch (error) {
    throw httpError(error.name === 'TimeoutError' ? 504 : 502, error.name === 'TimeoutError' ? 'Gmail request timed out' : 'Unable to connect to Gmail');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status === 401 ? 401 : 502, data.error_description || data.error?.message || 'Gmail API request failed');
  return data;
}

async function exchangeCode(code, state) {
  const userId = verifyState(state);
  const config = requiredConfig();
  const tokens = await googleRequest('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }),
  });
  if (!tokens.access_token) throw httpError(502, 'Google did not return an access token');
  const existing = await GmailConnection.findOne({ userId });
  const profile = await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  await GmailConnection.findOneAndUpdate({ userId }, {
    userId, email: profile.emailAddress || '', accessToken: encrypt(tokens.access_token),
    refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing?.refreshToken || null,
    tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000), scope: String(tokens.scope || SCOPE).split(' '), connectedAt: new Date(),
  }, { upsert: true, returnDocument: "after", runValidators: true });
  return { userId, email: profile.emailAddress || '' };
}

async function accessToken(connection) {
  if (connection.tokenExpiresAt.getTime() > Date.now() + 60000) return decrypt(connection.accessToken);
  if (!connection.refreshToken) throw httpError(401, 'Gmail authorization expired. Please reconnect Gmail.');
  const config = requiredConfig();
  const tokens = await googleRequest('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decrypt(connection.refreshToken), grant_type: 'refresh_token' }),
  });
  connection.accessToken = encrypt(tokens.access_token);
  connection.tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
  await connection.save();
  return tokens.access_token;
}

const includesAny = (text, terms) => terms.some(term => text.includes(term));

function classify(subject, snippet) {
  const subjectText = String(subject || '').toLowerCase();
  const text = `${subjectText} ${String(snippet || '').toLowerCase()}`;
  const jobContext = includesAny(text, ['application', 'candidate', 'position', 'role', 'job', 'recruit', 'hiring', 'interview', 'assessment', 'offer']);
  if (includesAny(text, ['unfortunately', 'not moving forward', 'not selected', 'other candidates', 'unable to proceed']) && includesAny(text, ['application', 'position', 'role', 'candidate'])) return { classification: 'Rejection', confidence: 'high' };
  if (includesAny(text, ['offer letter', 'job offer', 'offer of employment', 'pleased to offer'])) return { classification: 'Offer', confidence: 'high' };
  if (includesAny(text, ['interview scheduled', 'interview confirmation', 'confirmed interview', 'interview details'])) return { classification: 'Interview Scheduled', confidence: 'high' };
  if (includesAny(text, ['interview invitation', 'invite you to interview', 'schedule an interview', 'interview availability', 'invitation to interview'])) return { classification: 'Interview Invitation', confidence: 'high' };
  if (includesAny(text, ['assessment', 'coding test', 'technical test', 'online test', 'take-home assignment', 'assignment details'])) return { classification: 'Assessment', confidence: 'high' };
  const confirmationPhrases = ['application received', 'received your application', 'we have received your application', 'we received your application', 'application has been received', 'thank you for applying', 'thanks for applying', 'thanks for your application', 'application confirmation', 'application submitted', 'your application for'];
  if (includesAny(text, confirmationPhrases)) return { classification: 'Application Received', confidence: 'high' };
  if (jobContext && includesAny(subjectText, ['thank you for your interest', 'thanks for your interest'])) return { classification: 'Application Received', confidence: 'medium' };
  if (!jobContext) return null;
  if (includesAny(text, ['recruiter', 'talent acquisition', 'sourcing', 'career opportunity'])) return { classification: 'Recruiter Contact', confidence: 'medium' };
  return { classification: 'Needs Review', confidence: 'low' };
}

const ignoredTokens = new Set(['developer', 'engineer', 'senior', 'junior', 'role', 'position', 'company', 'limited', 'private', 'services', 'pvt', 'ltd', 'inc', 'llc', 'the', 'and']);
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();
const tokens = value => normalized(value).split(/\s+/).filter(token => token.length > 2 && !ignoredTokens.has(token));
const senderDomain = value => String(value || '').match(/@([a-z0-9.-]+)(?:>|\s|$)/i)?.[1]?.toLowerCase() || '';
const hostFromUrl = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const ignoredSourceDomains = new Set(['adzuna.in', 'linkedin.com', 'indeed.com', 'naukri.com']);

function matchApplication(applications, message) {
  const text = normalized(`${message.subject || ''} ${message.sender || ''} ${message.snippet || ''}`);
  const domain = senderDomain(message.sender);
  const receivedAt = message.receivedAt instanceof Date ? message.receivedAt : new Date(message.receivedAt || 0);
  const ranked = applications.map(application => {
    const job = application.jobId;
    if (!job) return { application, score: 0, signals: [] };
    let score = 0;
    const signals = [];
    const company = normalized(job.company);
    const companyWords = tokens(job.company);
    const titleWords = tokens(job.title);
    const companyMatches = companyWords.filter(token => text.includes(token));
    const titleMatches = titleWords.filter(token => text.includes(token));
    const companyCoverage = companyWords.length ? companyMatches.length / companyWords.length : 0;
    const titleCoverage = titleWords.length ? titleMatches.length / titleWords.length : 0;
    const senderText = normalized(message.sender);
    const exactCompany = company.length > 2 && text.includes(company);
    const senderCompany = companyWords.some(token => token.length >= 4 && (domain.includes(token) || senderText.includes(token)));
    if (exactCompany) { score += 6; signals.push('company'); }
    else if (companyCoverage >= 0.6) { score += 4; signals.push('company'); }
    else if (companyCoverage >= 0.34) { score += 2; signals.push('company-partial'); }
    if (senderCompany) { score += 4; signals.push('sender-domain'); }
    if (titleCoverage >= 0.75) { score += 4; signals.push('job-title'); }
    else if (titleCoverage >= 0.5) { score += 2; signals.push('job-title-partial'); }
    const sourceHosts = [hostFromUrl(application.applicationUrl), hostFromUrl(job.originalUrl)].filter(host => host && !ignoredSourceDomains.has(host));
    if (domain && sourceHosts.some(host => domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`))) { score += 4; signals.push('application-domain'); }
    const appliedAt = new Date(application.appliedAt || application.createdAt || 0);
    if (!Number.isNaN(receivedAt.getTime()) && !Number.isNaN(appliedAt.getTime())) {
      const ageHours = (receivedAt - appliedAt) / 3600000;
      if (ageHours >= -1 && ageHours <= 24 * 7) { score += 2; signals.push('recent'); }
      else if (ageHours >= -6 && ageHours <= 24 * 45) { score += 1; signals.push('time-window'); }
      else if (ageHours < -6) score -= 4;
    }
    const hasIdentity = signals.includes('company') || signals.includes('sender-domain') || signals.includes('application-domain') || (signals.includes('job-title') && (signals.includes('recent') || signals.includes('time-window')));
    return { application, score, signals, hasIdentity };
  }).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUpScore = ranked[1]?.score || 0;
  if (!best || !best.hasIdentity || best.score < 6 || best.score - runnerUpScore < 2) return null;
  return best;
}

const eventType = { Assessment: 'ASSESSMENT', 'Interview Invitation': 'INTERVIEW_INVITATION', 'Interview Scheduled': 'INTERVIEW_SCHEDULED', Offer: 'OFFER', 'Application Received': 'APPLICATION_RECEIVED', 'Application Confirmation': 'APPLICATION_RECEIVED', Rejection: 'REJECTION', 'Recruiter Contact': 'RECRUITER_CONTACT', 'Needs Review': 'EMAIL_UPDATE' };
const targetStatus = { 'Application Received': 'Application Received', 'Application Confirmation': 'Application Received', Assessment: 'Assessment', 'Interview Invitation': 'Interview', 'Interview Scheduled': 'Interview', Offer: 'Offer', Rejection: 'Rejected' };
const statusRank = { Applied: 0, 'Application Received': 1, Assessment: 2, Interview: 3, Offer: 4, Rejected: 4, Withdrawn: 5 };
const canAdvanceStatus = (current, next) => next && current !== 'Withdrawn' && statusRank[next] > (statusRank[current] ?? -1);

async function processMessage(userId, message, applications) {
  const headers = Object.fromEntries((message.payload?.headers || []).map(item => [item.name.toLowerCase(), item.value]));
  const subject = headers.subject || '';
  const sender = headers.from || '';
  const receivedAtValue = headers.date ? new Date(headers.date) : message.internalDate ? new Date(Number(message.internalDate)) : null;
  const receivedAt = Number.isNaN(receivedAtValue?.getTime()) ? null : receivedAtValue;
  const result = classify(subject, message.snippet || '');
  if (!result) return { ignored: true };
  let record = await GmailMessage.findOne({ userId, messageId: message.id });
  const wasProcessed = Boolean(record?.processedAt);
  const linked = record?.linkedApplication ? applications.find(application => String(application._id) === String(record.linkedApplication)) : null;
  const match = linked ? { application: linked, score: 100, signals: ['existing-link'] } : matchApplication(applications, { subject, sender, snippet: message.snippet || '', receivedAt });
  if (!record) {
    try {
      record = await GmailMessage.create({ userId, messageId: message.id, threadId: message.threadId, sender, subject, receivedAt, classification: result.classification, classificationConfidence: result.confidence, linkedApplication: match?.application._id || null });
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await GmailMessage.findOne({ userId, messageId: message.id });
    }
  }
  if (!record.linkedApplication) {
    record.sender = sender;
    record.subject = subject;
    record.receivedAt = receivedAt;
    record.classification = result.classification;
    record.classificationConfidence = result.confidence;
    record.linkedApplication = match?.application._id || null;
  }
  if (!match) {
    record.processedAt = new Date();
    await record.save();
    return wasProcessed ? { duplicate: true } : { processed: true, relevant: true, linked: false, needsReview: true, classification: record.classification };
  }
  const application = match.application;
  const classification = record.classification;
  let eventCreated = false;
  try {
    await ApplicationEvent.create({
      applicationId: application._id, type: eventType[classification], source: 'gmail', timestamp: record.receivedAt || new Date(), externalMessageId: message.id,
      title: classification, description: '', metadata: { gmailMessageId: message.id, gmailThreadId: message.threadId, senderDomain: senderDomain(sender), receivedAt: record.receivedAt, classification, matchScore: match.score, matchSignals: match.signals },
    });
    eventCreated = true;
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const job = application.jobId || {};
  const isConfirmation = classification === 'Application Received';
  await notify(userId, {
    type: isConfirmation ? 'GMAIL_APPLICATION_RECEIVED' : `GMAIL_${String(classification).toUpperCase().replace(/\s+/g, '_')}`,
    title: isConfirmation ? 'Application confirmation received' : `${classification} received`,
    message: `${job.company || 'Company'} — ${job.title || 'Application'} — ${classification}`,
    relatedApplication: application._id, relatedJob: job._id || application.jobId, dedupeKey: `gmail:${message.id}`,
  });
  let applicationUpdated = false;
  const next = targetStatus[classification];
  if (result.confidence === 'high' && canAdvanceStatus(application.status, next)) {
    application.status = next;
    await application.save();
    applicationUpdated = true;
  }
  record.linkedApplication = application._id;
  record.processedAt = new Date();
  await record.save();
  const duplicate = wasProcessed && !eventCreated && !applicationUpdated;
  return { processed: true, relevant: true, linked: true, classification, eventCreated, applicationUpdated, duplicate };
}

async function sync(userId) {
  const connection = await GmailConnection.findOne({ userId });
  if (!connection) throw httpError(409, 'Connect Gmail before syncing');
  const token = await accessToken(connection);
  const query = process.env.GMAIL_SYNC_QUERY || DEFAULT_SYNC_QUERY;
  const maxResults = String(Math.min(Math.max(Number(process.env.GMAIL_SYNC_MAX_RESULTS) || 100, 1), 100));
  const list = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: query, maxResults })}`, { headers: { Authorization: `Bearer ${token}` } });
  const applications = await Application.find({ userId }).populate('jobId');
  const summary = { scanned: (list.messages || []).length, relevant: 0, matched: 0, eventsCreated: 0, applicationsUpdated: 0, unmatched: 0, skipped: 0, duplicates: 0 };
  for (const item of list.messages || []) {
    const detailParams = new URLSearchParams({ format: 'metadata' });
    for (const header of ['Subject', 'From', 'Date']) detailParams.append('metadataHeaders', header);
    const message = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?${detailParams}`, { headers: { Authorization: `Bearer ${token}` } });
    const outcome = await processMessage(userId, message, applications);
    if (outcome.ignored) summary.skipped += 1;
    else if (outcome.duplicate) summary.duplicates += 1;
    else {
      summary.relevant += 1;
      if (outcome.linked) summary.matched += 1;
      if (outcome.eventCreated) summary.eventsCreated += 1;
      if (outcome.applicationUpdated) summary.applicationsUpdated += 1;
      if (outcome.needsReview) summary.unmatched += 1;
    }
  }
  connection.lastSyncedAt = new Date();
  await connection.save();
  return { ...summary, found: summary.scanned, processed: summary.relevant, linked: summary.matched, needsReview: summary.unmatched, ignored: summary.skipped };
}

async function metadataSearch(userId, query, maxResults = 100) {
  const connection = await GmailConnection.findOne({ userId });
  if (!connection) throw httpError(409, 'Connect Gmail before searching');
  const token = await accessToken(connection);
  const limit = String(Math.min(Math.max(Number(maxResults) || 100, 1), 100));
  const list = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: String(query || ''), maxResults: limit })}`, { headers: { Authorization: `Bearer ${token}` } });
  const messages = [];
  for (const item of list.messages || []) {
    const params = new URLSearchParams({ format: 'metadata' });
    for (const header of ['Subject', 'From', 'Date']) params.append('metadataHeaders', header);
    const message = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const headers = Object.fromEntries((message.payload?.headers || []).map(header => [header.name.toLowerCase(), header.value]));
    const receivedAt = headers.date ? new Date(headers.date) : message.internalDate ? new Date(Number(message.internalDate)) : null;
    messages.push({ messageId: message.id, receivedAt: Number.isNaN(receivedAt?.getTime()) ? null : receivedAt, sender: headers.from || '', subject: headers.subject || '' });
  }
  return messages;
}

async function status(userId) {
  const connection = await GmailConnection.findOne({ userId }).select('email connectedAt lastSyncedAt tokenExpiresAt');
  return connection ? { connected: true, email: connection.email, connectedAt: connection.connectedAt, lastSyncedAt: connection.lastSyncedAt } : { connected: false, email: null, connectedAt: null, lastSyncedAt: null };
}
async function disconnect(userId) {
  const result = await GmailConnection.deleteOne({ userId });
  return { connected: false, disconnected: result.deletedCount > 0 };
}

module.exports = { authorizationUrl, exchangeCode, status, sync, disconnect, metadataSearch, _test: { classify, matchApplication, canAdvanceStatus, DEFAULT_SYNC_QUERY } };
