/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import Sidebar from './sidebar';
import { Notice, formatDate } from './ApiState';
import { getAutoApplyHistory, getAutoApplyJobs, getAutoApplySettings, getAutoApplyStatus, markAutoApplyApplied, prepareAutoApplications, runAutoApply, saveAutoApplyCoverLetter, saveAutoApplySettings, updateAutoApplyDraft } from '../services/api';

const subOptions = [['FRONTEND', 'Frontend'], ['FULL_STACK', 'Full Stack'], ['BACKEND', 'Backend'], ['SOFTWARE_ENGINEERING', 'Software Engineering']];
const modes = ['Remote', 'Hybrid', 'On-site'];
const toggle = (list, value) => list.includes(value) ? list.filter(item => item !== value) : [...list, value];

export default function Autoapply() {
  const [settings, setSettings] = useState(null);
  const [engineStatus, setEngineStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState([]);
  const [review, setReview] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load(nextPage = page) {
    setLoading(true); setError('');
    try {
      const [settingsResponse, jobsResponse, historyResponse, statusResponse] = await Promise.all([getAutoApplySettings(), getAutoApplyJobs({ page: nextPage, limit: 10 }), getAutoApplyHistory(), getAutoApplyStatus()]);
      setSettings(settingsResponse.data); setJobs(jobsResponse.data.jobs); setPagination(jobsResponse.data.pagination); setHistory(historyResponse.data); setEngineStatus(statusResponse.data); setPage(nextPage);
    } catch (apiError) { setError(apiError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setList = (field, value) => setSettings(current => ({ ...current, [field]: toggle(current[field] || [], value) }));
  const split = value => value.split(',').map(item => item.trim()).filter(Boolean);
  async function saveSettingsNow() {
    setBusy('settings'); setError('');
    try { const response = await saveAutoApplySettings(settings); setSettings(response.data); setSelected([]); setMessage('Auto Apply preferences saved.'); await load(1); }
    catch (apiError) { setError(apiError.message); }
    finally { setBusy(''); }
  }
  async function runNow() {
    setBusy('run'); setError('');
    try { const response = await runAutoApply(); setMessage(response.message); await load(1); }
    catch (apiError) { setError(apiError.message); }
    finally { setBusy(''); }
  }
  async function prepare() {
    setBusy('prepare');
    try { const result = await prepareAutoApplications(selected); setReview(result.data[0]); setSelected([]); setMessage('Application prepared successfully.'); await load(page); }
    catch (apiError) { setError(apiError.message); }
    finally { setBusy(''); }
  }
  async function saveReview(status) {
    try { const result = await updateAutoApplyDraft(review._id, { coverLetter: review.coverLetter, answers: review.answers, summary: review.summary, ...(status && { status }) }); setReview(result.data); setMessage(status ? 'Application marked reviewed.' : 'Edits saved.'); await load(page); }
    catch (apiError) { setError(apiError.message); }
  }
  async function saveLetter() {
    try { await saveAutoApplyCoverLetter(review._id); setMessage('Cover letter draft saved.'); }
    catch (apiError) { setError(apiError.message); }
  }
  async function markApplied() {
    try { await markAutoApplyApplied(review._id); setConfirmOpen(false); setReview(null); setMessage('Application marked as applied. Existing Gmail tracking will monitor responses.'); await load(page); }
    catch (apiError) { setError(apiError.message); }
  }
  const checkbox = (field, value, label = value) => <label className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 cursor-pointer hover:bg-surface-container-low"><input type="checkbox" checked={(settings[field] || []).includes(value)} onChange={() => setList(field, value)} />{label}</label>;
  const stats = engineStatus?.statistics || {};

  return <div className="min-h-screen bg-background md:pl-sidebar-width"><Sidebar /><header className="h-16 sticky top-0 z-30 bg-surface border-b border-outline-variant flex items-center px-margin-page"><h1 className="font-title-lg text-title-lg">Auto Apply Assistant</h1></header><main className="p-4 md:p-margin-page max-w-container-max mx-auto space-y-6">
    <div><h2 className="font-headline-lg text-headline-lg">Automatic application assistant</h2><p className="text-on-surface-variant mt-1">Automatically queues eligible jobs. Unsupported, interactive, or unverified submissions always require review.</p></div>
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    {loading || !settings ? <Notice>Finding eligible jobs...</Notice> : <>
      <section className="bg-surface rounded-xl border border-outline-variant p-5 premium-shadow"><div className="flex flex-wrap justify-between gap-4"><div><h3 className="font-title-lg text-title-lg">Auto Apply</h3><p className="text-sm text-on-surface-variant">Current status: <strong>{engineStatus?.currentStatus || 'Idle'}</strong></p></div><button disabled={busy === 'run' || !settings.enabled || !settings.allowAutomaticSubmission} onClick={runNow} className="bg-primary text-white px-5 py-2 rounded-lg disabled:opacity-50">{busy === 'run' ? 'Starting...' : 'Run Now'}</button></div><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-5">{[['Eligible Jobs', jobs.length], ['Queued', stats.queued], ['Processing', stats.processing], ['Submitted', stats.submitted], ['Needs Review', stats.needsReview], ['Failed', stats.failed], ['Unsupported', stats.unsupported]].map(([label, value]) => <div key={label} className="bg-surface-container-low rounded-lg p-3"><p className="text-xs text-on-surface-variant">{label}</p><p className="font-title-lg text-title-lg">{value || 0}</p></div>)}</div></section>

      <section className="bg-surface rounded-xl border border-outline-variant p-5 premium-shadow"><div className="flex flex-wrap justify-between gap-3 mb-5"><div><h3 className="font-title-lg text-title-lg">Auto Apply Settings</h3><p className="text-sm text-on-surface-variant">Automatic submission must be enabled explicitly.</p></div><button disabled={busy === 'settings'} onClick={saveSettingsNow} className="bg-primary text-white px-5 py-2 rounded-lg disabled:opacity-50">{busy === 'settings' ? 'Saving...' : 'Save Settings'}</button></div>
        <div className="grid md:grid-cols-2 gap-5">
          <Toggle label="Auto Apply" checked={settings.enabled} onChange={enabled => setSettings({ ...settings, enabled })} />
          <Toggle label="Automatic Submission" checked={settings.allowAutomaticSubmission} onChange={allowAutomaticSubmission => setSettings({ ...settings, allowAutomaticSubmission })} />
          <NumberField label="Minimum Match Score" value={settings.minimumMatchScore} min="0" max="100" suffix="%" onChange={minimumMatchScore => setSettings({ ...settings, minimumMatchScore })} />
          <label><span className="font-semibold">Category</span><select className="w-full mt-2 rounded-lg border border-outline-variant p-2" value={settings.category || 'IT'} onChange={event => setSettings({ ...settings, category: event.target.value })}><option value="IT">IT / Software</option><option value="NON_IT">Non-IT</option><option value="ALL">All</option></select></label>
          <NumberField label="Maximum Applications Per Day" value={settings.maximumApplicationsPerDay} min="1" max="100" onChange={maximumApplicationsPerDay => setSettings({ ...settings, maximumApplicationsPerDay })} />
          <NumberField label="Maximum Applications Per Run" value={settings.maximumApplicationsPerRun} min="1" max="25" onChange={maximumApplicationsPerRun => setSettings({ ...settings, maximumApplicationsPerRun })} />
          <Option title="Preferred Subcategories">{subOptions.map(([value, label]) => <span key={value}>{checkbox('subcategories', value, label)}</span>)}</Option>
          <Option title="Work Modes">{modes.map(value => <span key={value}>{checkbox('preferredWorkModes', value)}</span>)}</Option>
          <TextList label="Preferred Roles" value={settings.preferredRoles} placeholder="Frontend Developer, React Developer" onChange={value => setSettings({ ...settings, preferredRoles: split(value) })} />
          <TextList label="Preferred Locations" value={settings.preferredLocations} placeholder="Hyderabad, Remote, Bangalore" onChange={value => setSettings({ ...settings, preferredLocations: split(value) })} />
          <TextList label="Excluded Companies" value={settings.excludedCompanies} placeholder="Company A, Company B" onChange={value => setSettings({ ...settings, excludedCompanies: split(value) })} />
          <TextList label="Excluded Roles" value={settings.excludedRoles} placeholder="Manager, Sales" onChange={value => setSettings({ ...settings, excludedRoles: split(value) })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-5"><Toggle label="Generate cover letter" checked={settings.autoGenerateCoverLetter} onChange={autoGenerateCoverLetter => setSettings({ ...settings, autoGenerateCoverLetter })} /><Toggle label="Generate answers" checked={settings.autoGenerateAnswers} onChange={autoGenerateAnswers => setSettings({ ...settings, autoGenerateAnswers })} /><Toggle label="Retry transient failures" checked={settings.retryFailedApplications} onChange={retryFailedApplications => setSettings({ ...settings, retryFailedApplications })} /></div>
      </section>

      <section className="bg-surface rounded-xl border border-outline-variant p-5 premium-shadow"><div className="flex flex-wrap justify-between gap-3 mb-4"><div><h3 className="font-title-lg text-title-lg">Eligible Jobs</h3><p className="text-sm text-on-surface-variant">The review-first preparation flow remains available.</p></div><button disabled={!selected.length || busy === 'prepare'} onClick={prepare} className="bg-primary text-white px-5 py-2 rounded-lg disabled:opacity-50">{busy === 'prepare' ? 'Preparing your application...' : `Prepare Selected Applications (${selected.length})`}</button></div>
        {!jobs.length ? <Notice>No jobs currently meet your Auto Apply preferences.</Notice> : <div className="space-y-3">{jobs.map(job => <label key={job._id} className="flex items-start gap-3 p-4 border border-outline-variant rounded-xl hover:bg-surface-container-low cursor-pointer"><input className="mt-1" type="checkbox" checked={selected.includes(job._id)} disabled={!selected.includes(job._id) && selected.length >= 10} onChange={() => setSelected(toggle(selected, job._id))} /><div><div className="flex flex-wrap gap-2"><strong>{job.matchScore}% {job.title}</strong><span className="text-xs px-2 py-1 bg-primary-container text-on-primary-container rounded-full">Eligible</span></div><p className="text-sm text-on-surface-variant">{job.company} · {job.location} · {job.workMode}</p><p className="text-xs text-on-surface-variant mt-1">{job.category} / {job.subcategory || 'Unclassified'} · {job.applicationPlatform || 'UNKNOWN'} · Posted {formatDate(job.postedAt)}</p></div></label>)}</div>}
        {pagination.totalPages > 1 && <div className="flex justify-center gap-3 mt-4"><button disabled={page <= 1} onClick={() => load(page - 1)} className="border border-outline-variant px-4 py-2 rounded-lg disabled:opacity-40">Previous</button><span className="py-2">Page {page} of {pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => load(page + 1)} className="border border-outline-variant px-4 py-2 rounded-lg disabled:opacity-40">Next</button></div>}
      </section>

      {review && <Review draft={review} setDraft={setReview} close={() => setReview(null)} save={saveReview} saveLetter={saveLetter} open={() => setConfirmOpen(true)} />}
      <section className="bg-surface rounded-xl border border-outline-variant p-5 premium-shadow"><h3 className="font-title-lg text-title-lg mb-4">Application History</h3>{!history.length ? <Notice>No application preparations yet.</Notice> : history.map(item => <button key={item._id} onClick={() => setReview(item)} className="w-full text-left grid md:grid-cols-6 gap-2 p-3 border-b border-outline-variant hover:bg-surface-container-low"><span className="md:col-span-2"><strong>{item.jobId?.title}</strong><small className="block text-on-surface-variant">{item.jobId?.company}</small></span><span>{item.matchScore}%</span><span>{item.applicationPlatform || 'UNKNOWN'}</span><span>{item.status}<small className="block text-on-surface-variant">Attempt {item.attemptCount || 0}</small></span><span>{formatDate(item.submittedAt || item.updatedAt)}</span></button>)}</section>
    </>}
  </main>{confirmOpen && review && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-surface rounded-xl max-w-md p-6"><h3 className="font-title-lg text-title-lg">Continue to application?</h3><p className="text-on-surface-variant mt-2">You are about to apply on the company&apos;s original application page. Mark it applied only after the target confirms submission.</p><div className="flex flex-wrap justify-end gap-3 mt-5"><button onClick={() => setConfirmOpen(false)} className="border border-outline-variant px-4 py-2 rounded-lg">Cancel</button><a href={review.jobId?.originalUrl} target="_blank" rel="noreferrer" className="bg-primary text-white px-4 py-2 rounded-lg">Continue to Application</a><button onClick={markApplied} className="bg-tertiary text-white px-4 py-2 rounded-lg">Mark as Applied</button></div></div></div>}</div>;
}

function Toggle({ label, checked, onChange }) { return <label className="flex gap-2 items-center"><input type="checkbox" checked={Boolean(checked)} onChange={event => onChange(event.target.checked)} /><span className="font-semibold">{label}: {checked ? 'ON' : 'OFF'}</span></label>; }
function NumberField({ label, value, onChange, min, max, suffix }) { return <label><span className="font-semibold">{label}</span><div className="flex items-center gap-2 mt-2"><input className="w-28 rounded-lg border border-outline-variant p-2" type="number" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} />{suffix}</div></label>; }
function Option({ title, children }) { return <div><p className="font-semibold mb-2">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>; }
function TextList({ label, value = [], placeholder, onChange }) { return <label><span className="font-semibold">{label}</span><input className="w-full mt-2 rounded-lg border border-outline-variant p-2" value={value.join(', ')} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>; }
function Review({ draft, setDraft, close, save, saveLetter, open }) { return <section className="bg-surface rounded-xl border-2 border-primary/30 p-5 premium-shadow"><div className="flex justify-between"><div><p className="text-sm text-primary font-semibold">Application Review</p><h3 className="font-title-lg text-title-lg">{draft.jobId?.title}</h3><p className="text-on-surface-variant">{draft.jobId?.company} · {draft.jobId?.location} · {draft.matchScore}% match · {draft.applicationPlatform || 'UNKNOWN'}</p></div><button onClick={close} className="material-symbols-outlined">close</button></div><div className="grid lg:grid-cols-2 gap-5 mt-5"><div><Field label="Application Summary" value={draft.summary || ''} onChange={value => setDraft({ ...draft, summary: value })} /><Field label="Cover Letter" large value={draft.coverLetter || ''} onChange={value => setDraft({ ...draft, coverLetter: value })} /></div><div><h4 className="font-semibold mb-2">Application Questions</h4>{(draft.answers || []).map((item, index) => <div className="mb-3" key={index}><input className="w-full rounded-t-lg border border-outline-variant p-2 font-semibold" value={item.question} onChange={event => setDraft({ ...draft, answers: draft.answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, question: event.target.value } : answer) })} /><textarea className="w-full min-h-24 rounded-b-lg border border-t-0 border-outline-variant p-2" value={item.answer} onChange={event => setDraft({ ...draft, answers: draft.answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, answer: event.target.value } : answer) })} /></div>)}</div></div><div className="flex flex-wrap gap-3 mt-5"><button onClick={() => save()} className="border border-outline-variant px-4 py-2 rounded-lg">Save Edits</button><button onClick={saveLetter} className="border border-outline-variant px-4 py-2 rounded-lg">Save Cover Letter Draft</button><button onClick={() => save('Reviewed')} className="bg-primary-container px-4 py-2 rounded-lg">Mark Reviewed</button><button onClick={open} className="bg-primary text-white px-4 py-2 rounded-lg">Open Original Application</button></div></section>; }
function Field({ label, value, onChange, large }) { return <label className="block mb-4"><span className="font-semibold">{label}</span><textarea className={`w-full mt-2 ${large ? 'min-h-72' : 'min-h-24'} rounded-lg border border-outline-variant p-3`} value={value} onChange={event => onChange(event.target.value)} /></label>; }
