const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7000/api';

export class ApiError extends Error { constructor(message,status){super(message);this.status=status} }
async function api(path, options={}) {
  const token=localStorage.getItem('jobpilot_token');
  const multipart=typeof FormData!=='undefined'&&options.body instanceof FormData;
  try {
    const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers:{...(options.body&&!multipart&&{'Content-Type':'application/json'}),...(token&&{Authorization:`Bearer ${token}`}),...options.headers}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new ApiError(payload.message||'Request failed',response.status);
    return payload;
  } catch(error) { if(error instanceof ApiError) throw error; throw new ApiError('Unable to connect to the server. Please try again.',0); }
}
const query=params=>{const q=new URLSearchParams();Object.entries(params||{}).forEach(([k,v])=>{if(v!==''&&v!=null)q.set(k,v)});return q.toString()?`?${q}`:''};
export const getJobs=p=>api(`/jobs${query(p)}`);export const getJobById=id=>api(`/jobs/${id}`);
export const getJobMatch=(id,force=false)=>api(`/jobs/${id}/match`,{method:'POST',body:JSON.stringify({force})});
export const generateCoverLetter=(id,options)=>api(`/jobs/${id}/cover-letter`,{method:'POST',body:JSON.stringify(options)});export const saveCoverLetterDraft=(id,data)=>api(`/jobs/${id}/cover-letter/drafts`,{method:'POST',body:JSON.stringify(data)});
export const importAdzunaJobs=data=>api('/jobs/import/adzuna',{method:'POST',body:JSON.stringify(data)});
export const saveJob=(jobId,notes='')=>api('/saved-jobs',{method:'POST',body:JSON.stringify({jobId,notes})});export const getSavedJobs=()=>api('/saved-jobs');export const deleteSavedJob=id=>api(`/saved-jobs/${id}`,{method:'DELETE'});export const updateSavedJob=(id,data)=>api(`/saved-jobs/${id}`,{method:'PATCH',body:JSON.stringify(data)});
export const createApplication=(jobId,data={})=>api('/applications',{method:'POST',body:JSON.stringify({jobId,...data})});export const getApplications=status=>api(`/applications${query({status})}`);export const getApplicationById=id=>api(`/applications/${id}`);export const updateApplication=(id,data)=>api(`/applications/${id}`,{method:'PATCH',body:JSON.stringify(data)});
export const getApplicationEvents=id=>api(`/applications/${id}/events`);export const addApplicationEvent=(id,data)=>api(`/applications/${id}/events`,{method:'POST',body:JSON.stringify(data)});
export const getProfile=()=>api('/profile');export const updateProfile=data=>api('/profile',{method:'PUT',body:JSON.stringify(data)});export const getResume=()=>api('/resume');
export const uploadResume=file=>{const body=new FormData();body.append('resume',file);return api('/resume/upload',{method:'POST',body})};export const deleteResume=id=>api(`/resume/${id}`,{method:'DELETE'});
export const extractResume=id=>api(`/resume/${id}/extract`,{method:'POST'});export const parseResume=id=>api(`/resume/${id}/parse`,{method:'POST'});
export const getDashboardSummary=()=>api('/dashboard/summary');export const getDashboardMatches=()=>api('/dashboard/matches');export const getDashboardApplications=()=>api('/dashboard/recent-applications');export const getDashboardInsights=()=>api('/dashboard/insights');
export const getSkillGapAnalysis=()=>api('/dashboard/skills');
export const getCompanies=()=>api('/companies');export const getCompany=name=>api(`/companies/${encodeURIComponent(name)}`);export const getCompanyJobs=name=>api(`/companies/${encodeURIComponent(name)}/jobs`);
export const getGmailAuth=()=>api('/gmail/auth');export const getGmailStatus=()=>api('/gmail/status');export const syncGmail=()=>api('/gmail/sync',{method:'POST'});
export const disconnectGmail=()=>api('/gmail/disconnect',{method:'DELETE'});
export const getNotifications=()=>api('/notifications');export const markNotificationRead=id=>api(`/notifications/${id}/read`,{method:'PUT'});export const markAllNotificationsRead=()=>api('/notifications/read-all',{method:'PUT'});
export const getAutoApplySettings=()=>api('/auto-apply/settings');export const saveAutoApplySettings=data=>api('/auto-apply/settings',{method:'PUT',body:JSON.stringify(data)});export const getAutoApplyStatus=()=>api('/auto-apply/status');export const runAutoApply=()=>api('/auto-apply/run',{method:'POST'});export const getAutoApplyQueue=()=>api('/auto-apply/queue');export const getAutoApplyJobs=params=>api(`/auto-apply/jobs${query(params)}`);export const prepareAutoApplications=jobIds=>api('/auto-apply/prepare',{method:'POST',body:JSON.stringify({jobIds})});export const getAutoApplyHistory=()=>api('/auto-apply/history');export const getAutoApplyDraft=id=>api(`/auto-apply/${id}`);export const retryAutoApply=id=>api(`/auto-apply/${id}/retry`,{method:'POST'});export const cancelAutoApply=id=>api(`/auto-apply/${id}/cancel`,{method:'POST'});export const approveAutoApply=id=>api(`/auto-apply/${id}/approve`,{method:'POST'});export const updateAutoApplyDraft=(id,data)=>api(`/auto-apply/drafts/${id}`,{method:'PATCH',body:JSON.stringify(data)});export const saveAutoApplyCoverLetter=id=>api(`/auto-apply/drafts/${id}/save-cover-letter`,{method:'POST'});export const markAutoApplyApplied=id=>api(`/auto-apply/drafts/${id}/mark-applied`,{method:'POST'});
