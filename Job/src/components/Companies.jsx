import{useEffect,useState}from'react';
import{Link}from'react-router-dom';
import Sidebar from'./sidebar';
import CompanyLogo from'./CompanyLogo';
import{Notice}from'./ApiState';
import{getCompanies}from'../services/api';

export default function Companies(){
 const[companies,setCompanies]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{getCompanies().then(r=>setCompanies(r.data||r.companies||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 const visible=companies.filter(c=>c.companyName?.toLowerCase().includes(search.toLowerCase()));
 return <main className="min-h-screen md:ml-sidebar-width bg-background"><Sidebar/><header className="h-16 sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-outline-variant flex items-center px-margin-page"><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full max-w-md rounded-lg border border-outline-variant px-4 py-2" placeholder="Search companies..."/></header><div className="p-4 md:p-margin-page max-w-container-max mx-auto"><h2 className="font-headline-lg text-headline-lg">Companies</h2><p className="text-on-surface-variant mb-6">Explore companies currently hiring.</p>{error?<Notice error>{error}</Notice>:loading?<Notice>Loading companies...</Notice>:visible.length===0?<Notice>No companies found.</Notice>:<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-gutter">{visible.map(c=><article key={c.companyName} className="interactive-card bg-surface rounded-xl border border-outline-variant p-6"><CompanyLogo name={c.companyName} size="lg"/><h3 className="font-title-lg text-title-lg mt-4">{c.companyName}</h3><p className="text-on-surface-variant mt-1">{c.jobCount} open jobs</p><p className="text-sm mt-3">{c.locations?.join(', ')||'Location unavailable'}</p><div className="flex flex-wrap gap-1 mt-3">{c.commonSkills?.slice(0,5).map(s=><span key={s} className="bg-surface-container px-2 py-1 rounded text-xs">{s}</span>)}</div><Link to={`/find-jobs?company=${encodeURIComponent(c.companyName)}`} className="inline-block mt-5 text-primary font-semibold">View {c.jobCount} Jobs</Link></article>)}</div>}</div></main>
}
