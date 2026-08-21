import{Link}from'react-router-dom';import{formatPostedAt}from'./ApiState';import CompanyLogo from'./CompanyLogo';
export default function JobCard({job,saved,applied,onSave,onApply,busy}){
    return <article className="interactive-card bg-surface rounded-xl border border-outline-variant p-6 overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-tertiary to-secondary"/>
        <div className="flex justify-between items-start mb-4">
            <div className="flex gap-4"><CompanyLogo name={job.company}/>
            <div>
                <h3 className="font-title-lg text-title-lg text-on-surface">{job.title}</h3>
                <p className="font-body-md text-on-surface-variant">{job.company}</p>
            </div>
            </div>{job.matchScore!=null&&<span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold">{job.matchScore}% Match</span>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-on-surface-variant text-sm">{[['location_on',job.location],['work',job.experience],['payments',job.salary],['home_work',job.workMode],['schedule',job.jobType]].map(([icon,value])=>value&&<span key={icon} className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">{icon}</span>{value}</span>)}
                </div>
                <div className="flex flex-wrap gap-2 mb-6">{job.skills?.map(skill=>
                    <span key={skill} className="px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-md text-xs">{skill}</span>)}
                    </div>
                    <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-outline-variant">
                        <span className="text-sm text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[17px]">schedule</span>
                            {job.source} · Posted {formatPostedAt(job.postedAt)}</span>
                            <div className="flex gap-3">
                                <button disabled={busy} onClick={()=>onSave?.(job)} className="p-2 rounded-lg border border-outline-variant text-on-surface-variant">
                                    <span className="material-symbols-outlined">{saved?'bookmark':'bookmark_border'}</span>
                                    </button>
                                    <Link to={`/jobs/${job._id}`} className="px-4 py-2 rounded-lg border border-primary text-primary font-semibold">View Details</Link>
                                    <button disabled={busy||applied} onClick={()=>onApply?.(job)} className="px-5 py-2 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-60">{applied?'Applied':'Open Application'}
                                        </button>
                                        </div>
                                        </div>
                                        </article>
}
