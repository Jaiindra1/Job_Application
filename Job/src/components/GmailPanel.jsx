import { useEffect, useState } from 'react';
import { disconnectGmail, getGmailAuth, getGmailStatus, syncGmail } from '../services/api';
import { formatDate } from './ApiState';

export default function GmailPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getGmailStatus().then(response => setStatus(response.data)).catch(apiError => setError(apiError.message));
  }, []);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const response = await getGmailAuth();
      window.location.assign(response.data.authUrl);
    } catch (apiError) {
      setError(apiError.message);
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await syncGmail();
      const data = response.data;
      setMessage(data.scanned === 0
        ? 'No new application emails were found.'
        : `Gmail synced: ${data.scanned} emails scanned, ${data.eventsCreated} application events found, ${data.applicationsUpdated} applications updated.`);
      const next = await getGmailStatus();
      setStatus(next.data);
    } catch (apiError) {
      setError(apiError.status === 409
        ? 'Connect Gmail to enable application tracking.'
        : apiError.status === 401
          ? 'Your Gmail connection needs to be renewed.'
          : 'Gmail could not be synced right now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      await disconnectGmail();
      setStatus({ connected: false, email: null, lastSyncedAt: null });
      setMessage('Gmail disconnected. Stored OAuth tokens were removed.');
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!status && !error) return <section className="mb-6 rounded-xl border border-outline-variant bg-surface p-5">Loading Gmail connection...</section>;

  return <section className="mb-6 rounded-xl border border-outline-variant bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${status?.connected ? 'bg-secondary-container text-secondary' : 'bg-surface-container text-primary'}`}>
          <span className="material-symbols-outlined">mail</span>
        </div>
        <div>
          <h3 className="font-title-lg text-title-lg">Gmail</h3>
          {status?.connected
            ? <p className="text-sm text-on-surface-variant"><span className="font-semibold text-secondary">✓ Gmail Connected</span>{status.email ? ` · ${status.email}` : ''}</p>
            : <p className="text-sm text-on-surface-variant">Connect Gmail to automatically track job application emails.</p>}
        </div>
      </div>
      <div className="flex gap-2">
        {status?.connected
          ? <><button disabled={busy} onClick={sync} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">{busy ? 'Syncing Gmail...' : 'Sync Now'}</button><button disabled={busy} onClick={disconnect} className="rounded-lg border border-outline-variant px-4 py-2">Disconnect</button></>
          : <button disabled={busy} onClick={connect} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">{busy ? 'Opening Google...' : 'Connect Gmail'}</button>}
      </div>
    </div>
    {status?.connected && <p className="mt-3 text-xs text-on-surface-variant">{status.lastSyncedAt ? `Last synced: ${formatDate(status.lastSyncedAt)} ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Gmail hasn't been synced yet."}</p>}
    {message && <p className="mt-3 text-sm text-secondary">{message}</p>}
    {error && <p className="mt-3 text-sm text-error">{error}</p>}
  </section>;
}
