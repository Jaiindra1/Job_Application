/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from './sidebar';
import CompanyLogo from './CompanyLogo';
import { Notice, formatDate, formatPostedAt } from './ApiState';
import { createApplication, deleteSavedJob, getSavedJobs, updateSavedJob } from '../services/api';

export default function SavedJobs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [pendingApplication, setPendingApplication] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() { setLoading(true); getSavedJobs().then(response => setItems(response.data || response.savedJobs || [])).catch(apiError => setError(apiError.message)).finally(() => setLoading(false)); }
  useEffect(load, []);
  async function remove(id) { try { await deleteSavedJob(id); setItems(current => current.filter(item => (item.jobId?._id || item.jobId) !== id)); setMessage('Job removed from saved jobs.'); } catch (apiError) { setMessage(apiError.message); } }
  function openApplication(job) {
    const opened = window.open(job.originalUrl, '_blank', 'noopener,noreferrer');
    setPendingApplication(job);
    setMessage(opened ? 'Application page opened. Confirm only after successful submission.' : 'Please allow pop-ups, then try again.');
  }
  async function confirmApplied() {
    if (!pendingApplication) return;
    setBusy(true);
    try {
      await createApplication(pendingApplication._id, { submissionConfirmed: true });
      setMessage('Application marked as applied after your confirmation.');
      setPendingApplication(null);
    } catch (apiError) {
      setMessage(apiError.status === 409 ? 'This job is already being tracked.' : apiError.message);
    } finally { setBusy(false); }
  }
  async function notes(item) {
    const value = window.prompt('Notes for this job', item.notes || '');
    if (value === null) return;
    try { const response = await updateSavedJob(item._id, { notes: value }); setItems(current => current.map(existing => existing._id === item._id ? (response.data || response.savedJob) : existing)); }
    catch (apiError) { setMessage(apiError.message); }
  }
  const visible = items.filter(item => `${item.jobId?.title} ${item.jobId?.company} ${item.jobId?.skills?.join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  return <main className="min-h-screen md:ml-sidebar-width bg-background"><Sidebar /><header className="h-16 sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-outline-variant flex items-center px-margin-page"><input value={search} onChange={event => setSearch(event.target.value)} className="w-full max-w-md rounded-full border border-outline-variant px-4 py-2" placeholder="Search jobs, companies, or keywords..." /></header><div className="p-4 md:p-margin-page max-w-container-max mx-auto"><h2 className="font-headline-lg text-headline-lg">Saved Jobs</h2><p className="text-on-surface-variant mt-1 mb-6">Jobs you&apos;ve saved for later.</p><div className="grid md:grid-cols-3 gap-gutter mb-6"><div className="interactive-card bg-surface rounded-xl p-6 border border-outline-variant"><p className="text-on-surface-variant">Total Saved</p><span className="font-display-lg text-display-lg">{items.length}</span></div></div>{message && <div className="mb-4"><Notice>{message}</Notice></div>}{error ? <Notice error>{error}</Notice> : loading ? <Notice>Loading saved jobs...</Notice> : visible.length === 0 ? <Notice>No saved jobs yet. Save jobs you&apos;re interested in and they&apos;ll appear here.</Notice> : <div className="space-y-4">{visible.map(item => { const job = item.jobId || {}; return <article key={item._id} className="interactive-card bg-surface rounded-xl border border-outline-variant p-5 flex flex-col md:flex-row gap-5 justify-between"><div className="flex gap-4"><CompanyLogo name={job.company} /><div><h3 className="font-title-lg text-title-lg">{job.title}</h3><p className="text-on-surface-variant">{job.company} · {job.location}</p><div className="flex flex-wrap gap-2 my-3">{job.skills?.map(skill => <span key={skill} className="bg-surface-container px-2 py-1 rounded-md text-xs">{skill}</span>)}</div><p className="text-sm text-on-surface-variant">Posted {formatPostedAt(job.postedAt)} · Saved {formatDate(item.savedAt || item.createdAt)}</p>{item.notes && <p className="text-sm mt-2">Notes: {item.notes}</p>}</div></div><div className="flex flex-wrap md:items-end gap-2"><button onClick={() => notes(item)} className="px-4 py-2 border rounded-lg">Notes</button><button onClick={() => remove(job._id)} className="px-4 py-2 border rounded-lg text-error">Remove</button><Link to={`/jobs/${job._id}`} className="px-4 py-2 border rounded-lg">View</Link><button onClick={() => openApplication(job)} className="px-4 py-2 bg-primary text-white rounded-lg">Open Application</button></div></article>; })}</div>}</div>
    {pendingApplication && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-xl bg-surface p-6"><h3 className="font-title-lg text-title-lg">Was the application submitted?</h3><p className="mt-2 text-on-surface-variant">Only confirm after the target website reports a successful submission.</p><div className="mt-5 flex justify-end gap-3"><button onClick={() => setPendingApplication(null)} className="rounded-lg border border-outline-variant px-4 py-2">Not yet</button><button disabled={busy} onClick={confirmApplied} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60">Yes, submission confirmed</button></div></div></div>}
  </main>;
}
