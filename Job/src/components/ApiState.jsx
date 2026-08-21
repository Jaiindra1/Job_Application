/* eslint-disable react-refresh/only-export-components */
export function Notice({children,error=false}){return <div className={`rounded-lg border p-4 text-sm ${error?'border-error/30 bg-error-container text-on-error-container':'border-outline-variant bg-surface-container-low text-on-surface-variant'}`}>{children}</div>}
export const formatDate=value=>value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(value)):'Not specified';
export const formatPostedAt=value=>value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Posting time unavailable';
