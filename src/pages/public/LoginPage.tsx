import React,{useEffect,useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {Loader2,Phone,ShieldCheck,ArrowRight,KeyRound} from 'lucide-react';
import {onAuthStateChanged,signInWithCustomToken,User as FirebaseUser} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {auth,db} from '../../lib/firebase';
import {UniqueUser} from '../../lib/os/types';

export default function LoginPage(){
  const navigate=useNavigate(),location=useLocation();
  const[loading,setLoading]=useState(false),[error,setError]=useState(''),
    [message,setMessage]=useState(typeof location.state?.message==='string'?location.state.message:''),
    [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[handled,setHandled]=useState(false);
  const from=location.state?.from?.pathname||'/os/dashboard';

  const finish=async(u:FirebaseUser)=>{
    const s=await getDoc(doc(db,'users',u.uid));
    const d=s.exists()?s.data() as Partial<UniqueUser>:null;
    if(!u.phoneNumber&&!d?.phone){setError('A verified phone number is required for this account.');return;}
    navigate(from,{replace:true});
  };

  useEffect(()=>{
    let active=true;
    const complete=async(u:FirebaseUser)=>{
      if(!active||handled)return;
      setHandled(true);setLoading(true);
      try{await finish(u);}
      catch(e:any){setHandled(false);setError(e.message||'We could not open your account.');}
      finally{if(active)setLoading(false);}
    };
    const unsub=onAuthStateChanged(auth,u=>{if(u)void complete(u);});
    return()=>{active=false;unsub();};
  },[handled]);

  const login=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');
    const id=identifier.trim();
    if(!/^0\d{10}$/.test(id)&&!/^\d{10}$/.test(id)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)){
      setError('Use your 11-digit phone number, 10-digit Unique ID, or verified email.');return;
    }
    if(!/^\d{6}$/.test(password)){setError('Your Login PIN must be exactly 6 digits.');return;}
    setLoading(true);
    try{
      const r=await fetch('/api/auth/phone/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:id,password})});
      const b=await r.json();
      if(!r.ok)throw new Error(b?.error?.message||'Invalid login identifier or 6-digit Login PIN.');
      await signInWithCustomToken(auth,b.customToken);
    }catch(e:any){setError(e.message||'Unable to sign in.');}
    finally{setLoading(false);}
  };

  return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 sm:py-12">
    <div className="up-auth-card bg-white shadow-lg border border-slate-200">
      <div className="text-center mb-7">
        <div className="inline-flex rounded-xl bg-slate-900 text-white px-3.5 py-1.5 text-xs font-medium tracking-wide mb-4">UNIQUE ID + UNIQUEPAY</div>
        <h1 className="up-auth-title text-slate-900">Welcome back</h1>
        <p className="up-auth-subtitle text-slate-500 mt-2">Sign in with your phone number, Unique ID, or verified email.</p>
      </div>

      {error&&<div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}
      {message&&<div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-700 rounded-lg text-sm" role="status">{message}</div>}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 mb-6 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5"/>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Recommended login</p>
          <p className="up-auth-helper text-slate-600 mt-1">Your phone is your primary identity. Your session stays active until you sign out or clear authentication data on this device.</p>
        </div>
      </div>

      <form onSubmit={login} className="space-y-4">
        <div className="up-auth-section">
          <label className="up-auth-label text-slate-700" htmlFor="login-identifier">Phone number, Unique ID, or verified email</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"/>
            <input id="login-identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} className="up-auth-input w-full pl-10 pr-4 border border-slate-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500/15 outline-none" placeholder="08012345678 / 8012345678 / email" autoComplete="username" required/>
          </div>
        </div>

        <div className="up-auth-section">
          <label className="up-auth-label text-slate-700" htmlFor="login-pin">6-digit Login PIN</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"/>
            <input id="login-pin" type="password" inputMode="numeric" maxLength={6} value={password} onChange={e=>setPassword(e.target.value.replace(/\D/g,''))} className="up-auth-input w-full pl-10 pr-4 border border-slate-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500/15 outline-none" placeholder="••••••" autoComplete="current-password" required/>
          </div>
        </div>

        <button disabled={loading} className="up-auth-button w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg flex items-center justify-center gap-2 transition-colors">
          {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<>Log in <ArrowRight className="w-4 h-4"/></>}
        </button>
      </form>

      <div className="flex items-center justify-between gap-4 mt-5 pt-1">
        <Link to="/forgot-password" className="text-sm font-medium text-green-700 hover:text-green-800 inline-flex items-center gap-1">Forgot password? <KeyRound className="w-4 h-4"/></Link>
        <Link to="/register" className="text-sm font-medium text-slate-700 hover:text-slate-900 text-right">Create account</Link>
      </div>

      <p className="text-center up-auth-helper text-slate-500 mt-5 pt-4 border-t border-slate-100">Secure access to your UniquePlatform account.</p>
    </div>
  </div>;
}
