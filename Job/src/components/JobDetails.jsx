/* loadMatch is intentionally refreshed only when the route id changes. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "./sidebar";
import CompanyLogo from "./CompanyLogo";
import { Notice, formatPostedAt } from "./ApiState";
import {
  createApplication,
  generateCoverLetter,
  getJobById,
  getJobMatch,
  saveCoverLetterDraft,
  saveJob,
} from "../services/api";

function MatchPanel({ match, loading, error, onRetry }) {
  return (
    <aside className="lg:sticky lg:top-6 h-fit overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-surface to-secondary/[0.05] shadow-[0_16px_48px_rgba(53,37,205,0.10)]">
      <div className="border-b border-primary/10 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Profile Match
            </p>
            <h2 className="mt-1 font-headline-lg text-2xl font-bold">
              Your fit for this role
            </h2>
          </div>
          {match && (
            <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-primary/20 bg-white text-xl font-bold text-primary">
              {match.score}%
            </div>
          )}
        </div>
      </div>
      <div className="space-y-6 p-6">
        {loading ? (
          <Notice>Analyzing the job against your structured profile...</Notice>
        ) : error ? (
          <>
            <Notice error>{error}</Notice>
            <button
              onClick={onRetry}
              className="w-full rounded-lg border border-primary px-4 py-2 font-semibold text-primary"
            >
              Try Again
            </button>
          </>
        ) : match ? (
          <>
            <section>
              <p className="mb-3 text-lg font-bold text-primary">{match.level}</p>
              <h3 className="mb-2 font-bold uppercase tracking-wide text-primary">
                Why you match
              </h3>
              <p className="leading-relaxed text-on-surface-variant">
                {match.whyMatch}
              </p>
            </section>
            <section className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-container-low p-3"><strong>Experience</strong><p>{match.experienceMatch ? "Matches" : "Not confirmed"}</p></div>
              <div className="rounded-xl bg-surface-container-low p-3"><strong>Location</strong><p>{match.locationMatch ? "Matches" : "Does not match"}</p></div>
            </section>
            <section>
              <h3 className="mb-3 font-bold">Requirements you satisfy</h3>
              {match.satisfiedRequirements.length ? (
                <div className="flex flex-wrap gap-2">
                  {match.satisfiedRequirements.map((item) => (
                    <span
                      key={`${item.type}-${item.skill}`}
                      className="rounded-full bg-primary-fixed px-3 py-1.5 text-sm font-semibold"
                    >
                      {item.skill}{" "}
                      <span className="text-[10px] uppercase opacity-70">
                        {item.type}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  No explicit skill overlap was identified.
                </p>
              )}
            </section>
            <section className="rounded-xl border border-error/15 bg-error-container/40 p-4">
              <h3 className="mb-2 font-bold uppercase">Missing</h3>
              <p className="text-sm">
                {[
                  ...match.missingRequirements.required,
                  ...match.missingRequirements.preferred,
                ].join(", ") || "No explicit skill gaps identified."}
              </p>
            </section>
            <section className="rounded-xl bg-surface-container-low p-4">
              <h3 className="mb-2 font-bold uppercase">
                Improve before applying
              </h3>
              <p className="text-sm text-on-surface-variant">{match.improve}</p>
            </section>
            <p className="text-center text-[11px] text-outline">
              {match.cached
                ? "Cached result · no new AI request"
                : "New analysis generated"}{" "}
              · Based only on your saved profile
            </p>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function CoverLetterPanel({ jobId }) {
  const [tone, setTone] = useState("professional"),
    [length, setLength] = useState("medium"),
    [content, setContent] = useState(""),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function generate() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await generateCoverLetter(jobId, { tone, length });
      setContent((result.data || result).content);
      setMessage(
        "Generated text is not saved yet. Review and edit it before saving.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setMessage("Cover letter copied to clipboard.");
    } catch {
      setError("Unable to copy. Select the text and copy it manually.");
    }
  }
  async function save() {
    setLoading(true);
    setError("");
    try {
      await saveCoverLetterDraft(jobId, { content, tone, length });
      setMessage("Draft saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-title-lg text-xl font-bold">AI Cover Letter</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Generated only from your profile, extracted resume, and this job
            description.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-semibold text-on-surface-variant">
            Tone
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="ml-2 rounded-lg border-outline-variant text-sm"
            >
              <option value="professional">Professional</option>
              <option value="confident">Confident</option>
              <option value="concise">Concise</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-on-surface-variant">
            Length
            <select
              value={length}
              onChange={(event) => setLength(event.target.value)}
              className="ml-2 rounded-lg border-outline-variant text-sm"
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
            </select>
          </label>
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Notice error>{error}</Notice>
        </div>
      )}
      {message && (
        <div className="mt-4">
          <Notice>{message}</Notice>
        </div>
      )}
      {content ? (
        <>
          <textarea
            aria-label="Editable cover letter"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows="16"
            className="mt-4 w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-4 leading-7 focus:border-primary focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={loading}
              onClick={generate}
              className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary disabled:opacity-60"
            >
              {loading ? "Generating..." : "Regenerate"}
            </button>
            <button
              onClick={copy}
              className="rounded-lg border border-outline-variant px-4 py-2 font-semibold"
            >
              Copy
            </button>
            <button
              disabled={loading || !content.trim()}
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              Save Draft
            </button>
          </div>
        </>
      ) : (
        <button
          disabled={loading}
          onClick={generate}
          className="mt-5 rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Generating Cover Letter..." : "Generate Cover Letter"}
        </button>
      )}
      <p className="mt-3 text-xs text-on-surface-variant">
        Nothing is sent automatically. A draft is stored only when you select
        Save Draft.
      </p>
    </section>
  );
}

export default function JobDetails() {
  const { id } = useParams(),
    [job, setJob] = useState(),
    [match, setMatch] = useState(),
    [loading, setLoading] = useState(true),
    [matchLoading, setMatchLoading] = useState(true),
    [error, setError] = useState(""),
    [matchError, setMatchError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    getJobById(id)
      .then((result) => setJob(result.data || result.job))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    loadMatch();
  }, [id]);
  async function loadMatch(force = false) {
    const refresh = force === true || force?.type === "click";
    setMatchLoading(true);
    setMatchError("");
    try {
      const result = await getJobMatch(id, refresh);
      setMatch(result.data || result.match);
    } catch (err) {
      setMatchError(
        err.status === 409
          ? "Complete your Profile to generate a trustworthy match explanation."
          : err.message,
      );
    } finally {
      setMatchLoading(false);
    }
  }
  async function action(fn, ok) {
    try {
      await fn(id);
      setMessage(ok);
    } catch (err) {
      setMessage(
        err.status === 409
          ? "This action has already been recorded."
          : err.message,
      );
    }
  }
  if (loading)
    return (
      <main className="min-h-screen md:ml-sidebar-width bg-background">
        <Sidebar />
        <div className="p-margin-page">
          <Notice>Loading job details...</Notice>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen md:ml-sidebar-width bg-background">
      <Sidebar />
      <div className="mx-auto max-w-[1280px] p-4 md:p-8">
        <Link
          to="/find-jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to jobs
        </Link>
        {error ? (
          <div className="mt-5">
            <Notice error>{error}</Notice>
          </div>
        ) : (
          job && (
            <>
              <header className="relative mt-5 overflow-hidden rounded-2xl border border-outline-variant bg-surface p-6 md:p-8">
                <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-start">
                  <div className="flex gap-4">
                    <CompanyLogo name={job.company} size="lg" />
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold uppercase">
                          {job.source}
                        </span>
                        <span className="text-sm text-on-surface-variant">
                          Posted {formatPostedAt(job.postedAt)}
                        </span>
                      </div>
                      <h1 className="font-headline-lg text-3xl font-bold md:text-4xl">
                        {job.title}
                      </h1>
                      <p className="mt-2 text-lg text-on-surface-variant">
                        {job.company} · {job.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => action(saveJob, "Job saved successfully.")}
                      className="rounded-lg border border-primary px-5 py-3 font-semibold text-primary"
                    >
                      Save
                    </button>
                    <button
                      onClick={() =>
                        action(
                          createApplication,
                          "Application added for tracking as Prepared. This does not mean it was submitted.",
                        )
                      }
                      className="rounded-lg bg-primary px-5 py-3 font-semibold text-white"
                    >
                      Track Application
                    </button>
                    <a href={job.originalUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Open Application</a>
                  </div>
                </div>
                {message && (
                  <div className="mt-5">
                    <Notice>{message}</Notice>
                  </div>
                )}
              </header>
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-6">
                  <section className="rounded-2xl border border-outline-variant bg-surface p-6">
                    <h2 className="font-title-lg text-xl font-bold">
                      Role overview
                    </h2>
                    <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                      {[
                        ["work", "Experience", job.experience],
                        ["payments", "Salary", job.salary],
                        ["schedule", "Job type", job.jobType],
                        ["home_work", "Work mode", job.workMode],
                        ["location_on", "Location", job.location],
                        ["database", "Source", job.source],
                      ].map(([icon, label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl bg-surface-container-low p-4"
                        >
                          <span className="material-symbols-outlined text-primary">
                            {icon}
                          </span>
                          <dt className="mt-2 text-xs uppercase text-on-surface-variant">
                            {label}
                          </dt>
                          <dd className="mt-1 font-semibold">
                            {value || "Not specified"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  {job.skills?.length > 0 && (
                    <section className="rounded-2xl border border-outline-variant bg-surface p-6">
                      <h2 className="font-title-lg text-xl font-bold">
                        Skills listed by employer
                      </h2>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {job.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="rounded-2xl border border-outline-variant bg-surface p-6">
                    <h2 className="font-title-lg text-xl font-bold">
                      Job description
                    </h2>
                    <p className="mt-4 whitespace-pre-wrap leading-7 text-on-surface-variant">
                      {job.description || "No description provided."}
                    </p>
                    {job.originalUrl && (
                      <a
                        href={job.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-inverse-surface px-5 py-3 font-semibold text-inverse-on-surface"
                      >
                        View Original Job
                        <span className="material-symbols-outlined text-lg">
                          open_in_new
                        </span>
                      </a>
                    )}
                  </section>
                  <CoverLetterPanel jobId={id} />
                </div>
                <MatchPanel
                  match={match}
                  loading={matchLoading}
                  error={matchError}
                  onRetry={() => loadMatch(true)}
                />
              </div>
            </>
          )
        )}
      </div>
    </main>
  );
}
