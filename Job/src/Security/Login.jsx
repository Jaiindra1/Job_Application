import{useState}from'react';
import{Link,useNavigate}from'react-router-dom';
import{request,save}from'./auth';
export function Shell({title,subtitle,children}){
    return <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <section className="w-full max-w-md">
            <header className="text-center mb-6">
                <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-primary text-white grid place-items-center text-2xl font-bold">J</div>
                <h1 className="font-headline-md text-3xl font-bold">JobPilot AI</h1>
            </header>
            <div className="bg-white border border-outline-variant rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="text-on-surface-variant mt-1 mb-6">{subtitle}</p>
                {children}</div>
            </section>
            </main>
}
export function Field({label,type='text',value,onChange}){
    return <label className="block text-sm font-semibold">{label}
    <input required className="mt-2 w-full rounded-lg border border-outline-variant bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" type={type} value={value} onChange={e=>onChange(e.target.value)}/>
    </label>
    
}
export const Msg=({children,ok})=>
<div className={`rounded-lg p-3 text-sm ${ok?'bg-secondary-container':'bg-error-container text-on-error-container'}`}>{children}</div>
;
export const Btn=({busy,children})=><button disabled={busy} className="w-full bg-primary text-white rounded-lg py-3.5 font-bold disabled:opacity-60">{busy?'Please wait…':children}</button>;
export default function Login(){const[f,setF]=useState({email:'',password:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false),nav=useNavigate();async function submit(e){e.preventDefault();setBusy(true);setError('');try{const d=await request('login',f);save(d);nav('/')}catch(x){setError(x.message)}finally{setBusy(false)}}return <Shell title="Welcome back" subtitle="Login to manage your job search"><form className="space-y-5" onSubmit={submit}>{error&&<Msg>{error}</Msg>}<Field label="Email address" type="email" value={f.email} onChange={email=>setF({...f,email})}/><Field label="Password" type="password" value={f.password} onChange={password=>setF({...f,password})}/><div className="text-right"><Link className="text-primary text-sm font-semibold" to="/reset-password">Forgot password?</Link></div><Btn busy={busy}>Login</Btn></form><p className="mt-6 text-center text-sm">New here? <Link className="text-primary font-bold" to="/signup">Sign up</Link></p></Shell>}
