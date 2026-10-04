import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Globe2, LogIn, Plane, Search, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type FlightType = 'domestic' | 'international';
type TripType = 'round' | 'oneway';
type Stage = 'form' | 'review' | 'ready';
type Draft = {
  flightType: FlightType; tripType: TripType; from: string; to: string; departure: string;
  returnDate: string; passengers: string; cabin: string; budget: string; notes: string;
  action?: 'book' | 'request';
};

const KEY='uniqueplatform:guest-flight-draft';

const emptyDraft: Draft={flightType:'domestic',tripType:'round',from:'',to:'',departure:'',returnDate:'',passengers:'1',cabin:'Economy',budget:'',notes:''};

export default function FlightsPage(){
  const { currentUser }=useAuth();
  const navigate=useNavigate();
  const location=useLocation();
  const [draft,setDraft]=useState<Draft>(emptyDraft);
  const [stage,setStage]=useState<Stage>('form');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [pendingAction,setPendingAction]=useState<'book'|'request'|null>(null);

  useEffect(()=>{
    try{
      const saved=sessionStorage.getItem(KEY);
      if(saved)setDraft({...emptyDraft,...JSON.parse(saved)});
    }catch{}
  },[]);

  const update=(patch:Partial<Draft>)=>setDraft(v=>({...v,...patch}));
  const title=useMemo(()=>draft.flightType==='domestic'?'Domestic flights':'International flights',[draft.flightType]);

  const validate=()=>{
    if(!draft.from.trim()||!draft.to.trim()||!draft.departure){setError('Enter your origin, destination and departure date.');return false;}
    if(draft.tripType==='round'&&!draft.returnDate){setError('Choose a return date or switch to One-way.');return false;}
    if(Number(draft.passengers)<1){setError('Add at least one traveller.');return false;}
    setError('');return true;
  };

  const begin=(action:'book'|'request')=>{
    if(!validate())return;
    const next={...draft,action};
    sessionStorage.setItem(KEY,JSON.stringify(next));
    setDraft(next);setPendingAction(action);setStage('review');setNotice('');
  };

  const continueAction=()=>{
    if(!pendingAction)return;
    if(!currentUser){
      sessionStorage.setItem(KEY,JSON.stringify({...draft,action:pendingAction}));
      navigate('/login',{state:{from:{pathname:'/flights'},message:'Your flight details are saved. Log in to continue without starting again.'}});
      return;
    }
    setStage('ready');
    setNotice(pendingAction==='book'
      ?'Your flight search is prepared. Live airline availability, fares and booking must come from connected travel partners.'
      :'Your booking request is prepared. A live travel-desk submission endpoint is not connected yet, so nothing has been falsely marked as sent.');
  };

  useEffect(()=>{
    if(currentUser&&location.pathname==='/flights'&&draft.action&&!pendingAction&&stage==='form'){
      setPendingAction(draft.action);
      setStage('review');
    }
  },[currentUser,location.pathname,draft.action,pendingAction,stage]);

  const reset=()=>{sessionStorage.removeItem(KEY);setDraft(emptyDraft);setPendingAction(null);setStage('form');setNotice('');setError('');};

  return <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5"/> Home</Link>
            <div className="flex items-center gap-2 text-emerald-600"><Plane className="h-5 w-5"/><span className="text-sm font-black">Unique Travel • Flights</span></div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Search and prepare your journey first. You only need an account when you are ready to book or send a booking request.</p>
          </div>
          {currentUser&&<span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Signed in</span>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {([['domestic','Domestic Flight','Within Nigeria',Plane],['international','International Flight','Across borders',Globe2]] as const).map(([value,label,sub,Icon])=>
          <button key={value} onClick={()=>{update({flightType:value});setError('');}} className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${draft.flightType===value?'border-emerald-500 bg-emerald-50 shadow-sm':'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${draft.flightType===value?'text-emerald-600':'text-slate-500'}`}/><span className="text-sm font-black text-slate-900">{label}</span></div>
            <p className="mt-1 text-[11px] text-slate-500">{sub}</p>
          </button>
        )}
      </section>

      {stage==='form'&&<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(['round','oneway'] as const).map(value=><button key={value} onClick={()=>update({tripType:value})} className={`rounded-full px-3 py-1.5 text-xs font-bold ${draft.tripType===value?'bg-slate-950 text-white':'bg-slate-100 text-slate-600'}`}>{value==='round'?'Round trip':'One-way'}</button>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">From<input value={draft.from} onChange={e=>update({from:e.target.value})} placeholder={draft.flightType==='domestic'?'Abuja / Lagos / Kano…':'City or airport'} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
          <label className="text-xs font-bold text-slate-600">To<input value={draft.to} onChange={e=>update({to:e.target.value})} placeholder={draft.flightType==='domestic'?'Lagos / Abuja / Port Harcourt…':'City, airport or country'} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
          <label className="text-xs font-bold text-slate-600"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5"/> Departure</span><input type="date" value={draft.departure} onChange={e=>update({departure:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
          <label className="text-xs font-bold text-slate-600">Return date<input type="date" disabled={draft.tripType==='oneway'} value={draft.returnDate} onChange={e=>update({returnDate:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none disabled:bg-slate-100 focus:border-emerald-500"/></label>
          <label className="text-xs font-bold text-slate-600"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5"/> Travellers</span><input type="number" min="1" value={draft.passengers} onChange={e=>update({passengers:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
          <label className="text-xs font-bold text-slate-600">Cabin<select value={draft.cabin} onChange={e=>update({cabin:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500"><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></label>
          <label className="text-xs font-bold text-slate-600">Budget (optional)<input value={draft.budget} onChange={e=>update({budget:e.target.value})} placeholder="e.g. ₦250,000" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
          <label className="text-xs font-bold text-slate-600">Travel needs / preference (optional)<textarea value={draft.notes} onChange={e=>update({notes:e.target.value})} rows={1} placeholder="Flexible dates, baggage, accessibility…" className="mt-1 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
        </div>
        {error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button onClick={()=>begin('book')} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"><Search className="h-4 w-4"/> Search & Book <ArrowRight className="h-4 w-4"/></button>
          <button onClick={()=>begin('request')} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 hover:border-emerald-300"><CircleHelp className="h-4 w-4 text-emerald-600"/> Send Booking Request</button>
        </div>
      </section>}

      {stage==='review'&&<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600"/><h2 className="text-lg font-black text-slate-950">Review your flight details</h2></div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[['Route',`${draft.from} → ${draft.to}`],['Dates',draft.tripType==='oneway'?draft.departure:`${draft.departure} → ${draft.returnDate}`],['Travellers',draft.passengers],['Cabin',draft.cabin]].map(([a,b])=><div key={a} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{a}</p><p className="mt-1 font-bold text-slate-800">{b}</p></div>)}
        </div>
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          {pendingAction==='book'?<>You can search first without an account. An account is requested only before the booking step so your identity and payment can be secured.</>:<>You can prepare your request without an account. An account is requested only before the final request is sent so the travel desk can contact you securely.</>}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={()=>{setStage('form');setPendingAction(null);}} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Edit details</button>
          <button onClick={continueAction} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{currentUser?'Continue':'Log in / Create account'} <ChevronRight className="h-4 w-4"/></button>
        </div>
      </section>}

      {stage==='ready'&&<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-600"/><div><h2 className="text-lg font-black text-slate-950">Ready for the next step</h2><p className="mt-1 text-sm text-slate-600">{notice}</p></div></div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><strong>{draft.from} → {draft.to}</strong> · {draft.departure} · {draft.passengers} traveller(s) · {draft.cabin}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={()=>{setStage('form');setPendingAction(null);setNotice('')}} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Edit / start another</button>
          {!currentUser&&<Link to="/login" state={{from:{pathname:'/flights'}}} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><LogIn className="mr-1 inline h-4 w-4"/> Log in</Link>}
        </div>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600"/><p><strong className="text-slate-700">Truthful live-data rule:</strong> UniquePlatform will not invent airline availability, fares, booking confirmation or travel-desk submission. Those become live when the relevant provider/office integration is connected.</p></div>
      </section>
    </div>
  </div>;
}
