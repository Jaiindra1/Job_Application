import { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import JobCard from "./JobCard";
import { Notice } from "./ApiState";
import {
  createApplication,
  deleteSavedJob,
  getApplications,
  getJobs,
  getSavedJobs,
  importAdzunaJobs,
  saveJob,
} from "../services/api";

const empty = {
  search: "",
  location: "",
  company: "",
  experience: "",
  jobType: "",
  workMode: "",
  skill: "",
  salary: "",
  posted: "",
  sort: "newest",
  categoryMode: "recommended",
  subcategory: "",
};
const categoryOptions=[["recommended","Recommended for Me"],["IT","IT / Software"],["NON_IT","Non-IT"],["all","All"]];
const subcategoryOptions=[["","All IT roles"],["FRONTEND","Frontend"],["BACKEND","Backend"],["FULL_STACK","Full Stack"],["SOFTWARE_ENGINEERING","Software Engineering"],["MOBILE","Mobile"],["DEVOPS_CLOUD","DevOps / Cloud"],["DATA_AI","Data / AI"],["QA_TESTING","QA / Testing"],["CYBERSECURITY","Cybersecurity"],["UI_UX","UI/UX"]];
const filterOptions = [
  [
    "experience",
    "Experience",
    [
      ["", "Any"],
      ["0-1 years", "0-1 years"],
      ["1-3 years", "1-3 years"],
      ["3-5 years", "3-5 years"],
      ["5+ years", "5+ years"],
    ],
  ],
  [
    "jobType",
    "Job Type",
    [
      ["", "Any"],
      ["Full-time", "Full-time"],
      ["Part-time", "Part-time"],
      ["Contract", "Contract"],
      ["Internship", "Internship"],
    ],
  ],
  [
    "workMode",
    "Work Mode",
    [
      ["", "Any"],
      ["Remote", "Remote"],
      ["Hybrid", "Hybrid"],
      ["On-site", "On-site"],
    ],
  ],
  [
    "skill",
    "Skill",
    [
      ["", "Any"],
      ["React", "React"],
      ["JavaScript", "JavaScript"],
      ["TypeScript", "TypeScript"],
      ["Node.js", "Node.js"],
    ],
  ],
  [
    "posted",
    "Posted",
    [
      ["", "Any time"],
      ["1", "Today"],
      ["3", "Last 3 days"],
      ["7", "Last 7 days"],
      ["30", "Last 30 days"],
    ],
  ],
  [
    "salary",
    "Salary",
    [
      ["", "Any salary"],
      ["0-500000", "Up to ₹5 LPA"],
      ["500000-1000000", "₹5-10 LPA"],
      ["1000000-2000000", "₹10-20 LPA"],
      ["2000000+", "₹20+ LPA"],
    ],
  ],
];

export default function FindJob() {
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [saved, setSaved] = useState(new Set());
  const [applied, setApplied] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pendingApplication, setPendingApplication] = useState(null);

  useEffect(() => {
    let active = true;
    const categoryParams=filters.categoryMode==="recommended"?{recommended:true}:filters.categoryMode==="all"?{}:{category:filters.categoryMode};
    Promise.all([
      getJobs({ ...filters, categoryMode:undefined, ...categoryParams, subcategory:(filters.categoryMode==="recommended"||filters.categoryMode==="IT")?filters.subcategory:"", page, limit: 10 }),
      getSavedJobs(),
      getApplications(),
    ])
      .then(([jobResponse, savedResponse, applicationResponse]) => {
        if (!active) return;
        const jobData = Array.isArray(jobResponse.data)
          ? jobResponse.data
          : jobResponse.data?.jobs || jobResponse.jobs || [];
        const pagination =
          jobResponse.pagination || jobResponse.data?.pagination || {};
        setJobs(jobData);
        setTotal(pagination.total ?? jobResponse.totalJobs ?? 0);
        setPages(
          Math.max(pagination.totalPages ?? jobResponse.totalPages ?? 1, 1),
        );
        setSaved(
          new Set(
            (savedResponse.data || savedResponse.savedJobs || []).map(
              (item) => item.jobId?._id || item.jobId,
            ),
          ),
        );
        const submittedStatuses = new Set(["Applied", "Application Received", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"]);
        setApplied(
          new Set(
            (
              applicationResponse.data ||
              applicationResponse.applications ||
              []
            ).filter((item) => submittedStatuses.has(item.status)).map((item) => item.jobId?._id || item.jobId),
          ),
        );
        setError("");
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters, page]);

  async function search(event) {
    event.preventDefault();
    const next = {
      ...draft,
      search: draft.search.trim(),
      location: draft.location.trim(),
    };
    if (next.search.length > 200 || next.location.length > 120) {
      setError("Please shorten your search or location.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("Checking for fresh jobs...");
    try {
      const response = await importAdzunaJobs({
        what: next.search,
        where: next.location,
        page: 1,
        resultsPerPage: 20,
        maxPages: 5,
      });
      const result = response.data || {};
      setMessage(
        result.cached
          ? `Showing ${result.freshJobs} recently fetched jobs from the database.`
          : `${result.inserted} fresh jobs imported from Adzuna.`,
      );
    } catch (requestError) {
      setMessage(
        requestError.status === 401
          ? "Your session cannot import fresh jobs. Showing available jobs from the database."
          : "Unable to fetch fresh jobs right now. Showing available jobs from your database.",
      );
    }
    setPage(1);
    setFilters(next);
  }

  function applyFilters() {
    setLoading(true);
    setPage(1);
    setFilters(draft);
  }
  function clearFilters() {
    setLoading(true);
    setDraft(empty);
    setFilters(empty);
    setPage(1);
  }
  async function toggleSave(job) {
    setBusy(job._id);
    setMessage("");
    try {
      if (saved.has(job._id)) {
        await deleteSavedJob(job._id);
        setSaved((current) => {
          const next = new Set(current);
          next.delete(job._id);
          return next;
        });
        setMessage("Job removed from saved jobs.");
      } else {
        await saveJob(job._id);
        setSaved((current) => new Set(current).add(job._id));
        setMessage("Job saved successfully.");
      }
    } catch (requestError) {
      setMessage(
        requestError.status === 409
          ? "This job is already saved."
          : requestError.message,
      );
    } finally {
      setBusy("");
    }
  }
  function apply(job) {
    const opened=window.open(job.originalUrl,"_blank","noopener,noreferrer");
    setPendingApplication(job);
    setMessage(opened?"Application page opened. Mark it applied only after the target confirms submission.":"Please allow pop-ups, then open the application page again.");
  }
  async function confirmApplied() {
    const job=pendingApplication;
    if(!job)return;
    setBusy(job._id);
    try {
      await createApplication(job._id,{submissionConfirmed:true});
      setApplied((current) => new Set(current).add(job._id));
      setPendingApplication(null);
      setMessage("Application marked as applied after your confirmation.");
    } catch (requestError) {
      setMessage(
        requestError.status === 409
          ? "You have already added this job to your applications."
          : requestError.message,
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex-1 md:ml-sidebar-width flex flex-col min-h-screen bg-background">
      <Sidebar />
      <header className="w-full h-16 sticky top-0 z-30 bg-surface border-b border-outline-variant" />
      <main className="p-4 md:p-margin-page w-full max-w-container-max mx-auto">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
          Find Jobs
        </h2>
        <p className="text-on-surface-variant mb-6">
          Discover jobs that match your profile.
        </p>
        <form
          onSubmit={search}
          className="bg-surface p-6 rounded-xl border border-outline-variant mb-6 flex flex-col md:flex-row gap-4"
        >
          <input
            className="h-12 flex-1 px-4 text-base rounded-lg border border-outline-variant"
            placeholder="Job title, skills, or company"
            value={draft.search}
            onChange={(event) =>
              setDraft({ ...draft, search: event.target.value })
            }
          />
          <input
            className="h-12 flex-1 px-4 text-base rounded-lg border border-outline-variant"
            placeholder="Location"
            value={draft.location}
            onChange={(event) =>
              setDraft({ ...draft, location: event.target.value })
            }
          />
          <button
            disabled={loading}
            className="h-12 bg-primary text-on-primary px-8 rounded-lg font-semibold disabled:opacity-60"
          >
            {loading ? "Loading Jobs..." : "Search Jobs"}
          </button>
        </form>
        <div className="flex flex-col lg:flex-row gap-gutter">
          <aside className="w-full lg:w-72 bg-surface rounded-xl border border-outline-variant p-5 h-fit">
            <div className="flex justify-between mb-5">
              <h3 className="font-title-lg text-title-lg">Filters</h3>
              <button onClick={clearFilters} className="text-primary text-sm">
                Clear all
              </button>
            </div>
            <fieldset className="mb-5">
              <legend className="text-sm font-semibold mb-2">Category</legend>
              <div className="space-y-2">
                {categoryOptions.map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm font-medium"><input type="radio" name="categoryMode" value={value} checked={draft.categoryMode===value} onChange={event=>setDraft({...draft,categoryMode:event.target.value,subcategory:""})}/>{label}</label>)}
              </div>
            </fieldset>
            {(draft.categoryMode==="recommended"||draft.categoryMode==="IT")&&<label className="block mb-4 text-sm font-semibold">IT Sub-category<select className="mt-2 h-11 w-full rounded-lg border-outline-variant px-3 text-sm" value={draft.subcategory} onChange={event=>setDraft({...draft,subcategory:event.target.value})}>{subcategoryOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
            <label className="block mb-4 text-sm font-semibold">
              Company
              <input
                className="mt-2 h-11 w-full rounded-lg border-outline-variant px-3 text-sm"
                value={draft.company}
                onChange={(event) =>
                  setDraft({ ...draft, company: event.target.value })
                }
              />
            </label>
            {filterOptions.map(([key, label, options]) => (
              <label key={key} className="block mb-4 text-sm font-semibold">
                {label}
                <select
                  className="mt-2 h-11 w-full rounded-lg border-outline-variant px-3 text-sm"
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                >
                  {options.map(([value, text]) => (
                    <option key={text} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              onClick={applyFilters}
              className="h-11 w-full bg-surface-container border border-outline-variant rounded-lg px-4 font-semibold"
            >
              Apply filters
            </button>
          </aside>
          <section className="flex-1">
            <div className="flex justify-between items-center mb-5">
              <p className="text-on-surface-variant">
                Showing <strong className="text-on-surface">{jobs.length}</strong>{" "}
                of <strong className="text-on-surface">{total}</strong> jobs
              </p>
              <select
                value={draft.sort}
                onChange={(event) => {
                  const sort = event.target.value;
                  setDraft({ ...draft, sort });
                  setLoading(true);
                  setFilters({ ...filters, sort });
                }}
                className="h-11 min-w-44 border border-outline-variant rounded-lg px-3 text-sm"
              >
                <option value="newest">Most Recent</option>
                <option value="bestMatch">Best Match</option>
                <option value="salary">Salary</option>
                <option value="oldest">Oldest</option>
                <option value="company">Company</option>
                <option value="title">Title</option>
              </select>
            </div>
            {message && (
              <div className="mb-4">
                <Notice>{message}</Notice>
              </div>
            )}
            {error ? (
              <Notice error>{error}</Notice>
            ) : loading ? (
              <Notice>Loading jobs...</Notice>
            ) : jobs.length === 0 ? (
              <Notice>
                No matching jobs found. Try another role, skill, or location.
              </Notice>
            ) : (
              <div className="space-y-4 ">
                {jobs.map((job) => (
                  <JobCard
                    key={job._id}
                    job={job}
                    saved={saved.has(job._id)}
                    applied={applied.has(job._id)}
                    busy={busy === job._id}
                    onSave={toggleSave}
                    onApply={apply}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                disabled={page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current - 1);
                }}
                className="px-4 py-2 border rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button
                disabled={page >= pages || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current + 1);
                }}
                className="px-4 py-2 border rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>
        </div>
      </main>
      {pendingApplication&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-xl bg-surface p-6"><h3 className="font-title-lg text-title-lg">Was the application submitted?</h3><p className="mt-2 text-on-surface-variant">Only confirm after the employer or ATS shows a successful submission. Opening the page alone does not count as applying.</p><div className="mt-5 flex justify-end gap-3"><button onClick={()=>setPendingApplication(null)} className="rounded-lg border border-outline-variant px-4 py-2">Not yet</button><button disabled={busy===pendingApplication._id} onClick={confirmApplied} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60">Yes, submission confirmed</button></div></div></div>}
    </div>
  );
}
