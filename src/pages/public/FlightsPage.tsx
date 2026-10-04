import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Filter, Globe2, LogIn, Plane, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type FlightType = 'domestic' | 'international';
type TripType = 'round' | 'oneway';
type Stage = 'form' | 'results' | 'review' | 'ready';
type SortMode = 'recommended' | 'cheapest' | 'fastest' | 'earliest';
type Draft = {
  flightType: FlightType; tripType: TripType; from: string; to: string; departure: string;
  returnDate: string; passengers: string; cabin: string; budget: string; notes: string;
  preferences: string[]; action?: 'book' | 'request';
};

type PrototypeFlight = {
  id: string; type: FlightType; from: string; to: string; airline: string; flightNo: string;
  depart: string; arrive: string; duration: string; minutes: number; stops: string;
  baggage: string; cabin: string; price: number; currency: string; tag?: string;
};

const KEY = 'uniqueplatform:guest-flight-draft';

const emptyDraft: Draft = {
  flightType: 'domestic', tripType: 'round', from: '', to: '', departure: '', returnDate: '',
  passengers: '1', cabin: 'Economy', budget: '', notes: '', preferences: []
};

const domesticFlights: PrototypeFlight[] = [
  {id:'ng1',type:'domestic',from:'Abuja',to:'Lagos',airline:'Unique Demo Air',flightNo:'UD101',depart:'07:00',arrive:'08:05',duration:'1h 05m',minutes:65,stops:'Direct',baggage:'20kg',cabin:'Economy',price:85000,currency:'₦',tag:'Best match'},
  {id:'ng2',type:'domestic',from:'Lagos',to:'Abuja',airline:'Unique Demo Air',flightNo:'UD102',depart:'09:30',arrive:'10:35',duration:'1h 05m',minutes:65,stops:'Direct',baggage:'20kg',cabin:'Economy',price:82000,currency:'₦',tag:'Lowest fare'},
  {id:'ng3',type:'domestic',from:'Abuja',to:'Port Harcourt',airline:'Unique Demo Air',flightNo:'UD115',depart:'10:15',arrive:'11:25',duration:'1h 10m',minutes:70,stops:'Direct',baggage:'20kg',cabin:'Economy',price:91000,currency:'₦'},
  {id:'ng4',type:'domestic',from:'Lagos',to:'Port Harcourt',airline:'Unique Demo Air',flightNo:'UD124',depart:'12:20',arrive:'13:25',duration:'1h 05m',minutes:65,stops:'Direct',baggage:'20kg',cabin:'Economy',price:88000,currency:'₦'},
  {id:'ng5',type:'domestic',from:'Abuja',to:'Kano',airline:'Unique Demo Air',flightNo:'UD131',depart:'08:45',arrive:'09:45',duration:'1h 00m',minutes:60,stops:'Direct',baggage:'20kg',cabin:'Economy',price:79000,currency:'₦'},
  {id:'ng6',type:'domestic',from:'Lagos',to:'Kano',airline:'Unique Demo Air',flightNo:'UD145',depart:'11:00',arrive:'13:40',duration:'2h 40m',minutes:160,stops:'1 stop',baggage:'20kg',cabin:'Economy',price:105000,currency:'₦'},
  {id:'ng7',type:'domestic',from:'Abuja',to:'Owerri',airline:'Unique Demo Air',flightNo:'UD153',depart:'13:10',arrive:'14:25',duration:'1h 15m',minutes:75,stops:'Direct',baggage:'20kg',cabin:'Economy',price:94000,currency:'₦'},
  {id:'ng8',type:'domestic',from:'Lagos',to:'Enugu',airline:'Unique Demo Air',flightNo:'UD164',depart:'14:30',arrive:'15:40',duration:'1h 10m',minutes:70,stops:'Direct',baggage:'20kg',cabin:'Economy',price:90000,currency:'₦'},
  {id:'ng9',type:'domestic',from:'Abuja',to:'Calabar',airline:'Unique Demo Air',flightNo:'UD176',depart:'15:20',arrive:'16:35',duration:'1h 15m',minutes:75,stops:'Direct',baggage:'20kg',cabin:'Economy',price:98000,currency:'₦'},
  {id:'ng10',type:'domestic',from:'Lagos',to:'Uyo',airline:'Unique Demo Air',flightNo:'UD188',depart:'17:10',arrive:'18:20',duration:'1h 10m',minutes:70,stops:'Direct',baggage:'20kg',cabin:'Economy',price:93000,currency:'₦',tag:'Evening'},
];

const internationalFlights: PrototypeFlight[] = [
  {id:'int1',type:'international',from:'Lagos',to:'London',airline:'Unique Demo Air',flightNo:'UD201',depart:'09:10',arrive:'15:20',duration:'6h 10m',minutes:370,stops:'Direct',baggage:'30kg',cabin:'Economy',price:1250000,currency:'₦',tag:'Best match'},
  {id:'int2',type:'international',from:'Abuja',to:'London',airline:'Unique Demo Air',flightNo:'UD204',depart:'11:30',arrive:'17:55',duration:'6h 25m',minutes:385,stops:'Direct',baggage:'30kg',cabin:'Economy',price:1320000,currency:'₦'},
  {id:'int3',type:'international',from:'Lagos',to:'Dubai',airline:'Unique Demo Air',flightNo:'UD218',depart:'14:00',arrive:'23:10',duration:'9h 10m',minutes:550,stops:'Direct',baggage:'30kg',cabin:'Economy',price:980000,currency:'₦',tag:'Popular'},
  {id:'int4',type:'international',from:'Lagos',to:'Johannesburg',airline:'Unique Demo Air',flightNo:'UD226',depart:'08:40',arrive:'15:05',duration:'6h 25m',minutes:385,stops:'Direct',baggage:'30kg',cabin:'Economy',price:910000,currency:'₦'},
  {id:'int5',type:'international',from:'Lagos',to:'Accra',airline:'Unique Demo Air',flightNo:'UD233',depart:'07:20',arrive:'08:25',duration:'1h 05m',minutes:65,stops:'Direct',baggage:'23kg',cabin:'Economy',price:310000,currency:'₦',tag:'Lowest fare'},
  {id:'int6',type:'international',from:'Lagos',to:'Nairobi',airline:'Unique Demo Air',flightNo:'UD241',depart:'10:15',arrive:'18:30',duration:'8h 15m',minutes:495,stops:'1 stop',baggage:'30kg',cabin:'Economy',price:760000,currency:'₦'},
  {id:'int7',type:'international',from:'Abuja',to:'Accra',airline:'Unique Demo Air',flightNo:'UD249',depart:'12:10',arrive:'13:20',duration:'1h 10m',minutes:70,stops:'Direct',baggage:'23kg',cabin:'Economy',price:325000,currency:'₦'},
  {id:'int8',type:'international',from:'Lagos',to:'New York',airline:'Unique Demo Air',flightNo:'UD255',depart:'21:00',arrive:'05:15',duration:'13h 15m',minutes:795,stops:'1 stop',baggage:'30kg',cabin:'Economy',price:1650000,currency:'₦'},
  {id:'int9',type:'international',from:'Lagos',to:'Paris',airline:'Unique Demo Air',flightNo:'UD266',depart:'16:30',arrive:'23:20',duration:'6h 50m',minutes:410,stops:'Direct',baggage:'30kg',cabin:'Economy',price:1180000,currency:'₦'},
  {id:'int10',type:'international',from:'Lagos',to:'Istanbul',airline:'Unique Demo Air',flightNo:'UD278',depart:'19:15',arrive:'04:10',duration:'7h 55m',minutes:475,stops:'Direct',baggage:'30kg',cabin:'Economy',price:1090000,currency:'₦'},
];

const preferenceOptions = ['Lowest price','Fastest journey','Direct flight','More baggage','Morning flight','Avoid overnight','Window seat','Aisle seat','Family travel','Business travel','Accessibility assistance','Flexible dates'];

const money = (value:number) => value.toLocaleString('en-NG');

export default function FlightsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [draft,setDraft] = useState<Draft>(emptyDraft);
  const [stage,setStage] = useState<Stage>('form');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [pendingAction,setPendingAction] = useState<'book'|'request'|null>(null);
  const [selectedFlight,setSelectedFlight] = useState<PrototypeFlight|null>(null);
  const [sort,setSort] = useState<SortMode>('recommended');
  const [showFilters,setShowFilters] = useState(false);
  const [directOnly,setDirectOnly] = useState(false);
  const [maxBudget,setMaxBudget] = useState('');

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) setDraft({...emptyDraft,...JSON.parse(saved)});
    } catch {}
  }, []);

  const update = (patch:Partial<Draft>) => setDraft(v=>({...v,...patch}));
  const title = useMemo(()=>draft.flightType==='domestic'?'Domestic flights':'International flights',[draft.flightType]);

  const results = useMemo(() => {
    const source = draft.flightType==='domestic' ? domesticFlights : internationalFlights;
    const from = draft.from.trim().toLowerCase();
    const to = draft.to.trim().toLowerCase();
    let list = source.filter(f => (!from || f.from.toLowerCase().includes(from)) && (!to || f.to.toLowerCase().includes(to)));
    if (directOnly) list = list.filter(f=>f.stops==='Direct');
    const budget = Number(maxBudget.replace(/[^0-9.]/g,''));
    if (budget>0) list = list.filter(f=>f.price<=budget);
    return [...list].sort((a,b)=>{
      if(sort==='cheapest') return a.price-b.price;
      if(sort==='fastest') return a.minutes-b.minutes;
      if(sort==='earliest') return a.depart.localeCompare(b.depart);
      const preference = draft.preferences;
      const score = (f:PrototypeFlight) => (preference.includes('Lowest price') ? (2000000-f.price)/10000 : 0) + (preference.includes('Fastest journey') ? (1000-f.minutes) : 0) + (preference.includes('Direct flight') ? (f.stops==='Direct'?300:0) : 0) + (preference.includes('More baggage') ? parseInt(f.baggage,10) : 0) + (preference.includes('Morning flight') ? (f.depart<'12:00'?100:0) : 0);
      return score(b)-score(a);
    });
  },[draft.flightType,draft.from,draft.to,draft.preferences,sort,directOnly,maxBudget]);

  const validate = () => {
    if(!draft.from.trim()||!draft.to.trim()||!draft.departure){setError('Enter your origin, destination and departure date.');return false;}
    if(draft.tripType==='round'&&!draft.returnDate){setError('Choose a return date or switch to One-way.');return false;}
    if(Number(draft.passengers)<1){setError('Add at least one traveller.');return false;}
    setError(''); return true;
  };

  const searchFlights = () => {
    if(!validate()) return;
    sessionStorage.setItem(KEY,JSON.stringify(draft));
    setStage('results');
    setNotice('');
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const chooseFlight = (flight:PrototypeFlight) => {
    setSelectedFlight(flight);
    update({action:'book'});
    sessionStorage.setItem(KEY,JSON.stringify({...draft,action:'book',selectedFlightId:flight.id}));
    setStage('review');
  };

  const beginRequest = () => {
    if(!validate()) return;
    sessionStorage.setItem(KEY,JSON.stringify({...draft,action:'request'}));
    setPendingAction('request');
    setStage('review');
  };

  const continueAction = () => {
    const action = pendingAction || draft.action || 'book';
    if(!currentUser) {
      sessionStorage.setItem(KEY,JSON.stringify({...draft,action}));
      navigate('/login',{state:{from:{pathname:'/flights'},message:'Your flight details are saved. Log in to continue without starting again.'}});
      return;
    }
    setStage('ready');
    setNotice(action==='book'
      ?'Your selected flight is prepared. Live airline availability, fares and booking must come from connected travel partners.'
      :'Your booking request is prepared. A live travel-desk submission endpoint is not connected yet, so nothing has been falsely marked as sent.');
  };

  useEffect(() => {
    if(currentUser&&location.pathname==='/flights'&&draft.action&&!pendingAction&&stage==='form'){
      setPendingAction(draft.action); setStage('review');
    }
  },[currentUser,location.pathname,draft.action,pendingAction,stage]);

  const reset = () => { sessionStorage.removeItem(KEY); setDraft(emptyDraft); setPendingAction(null); setSelectedFlight(null); setStage('form'); setNotice(''); setError(''); };

  return <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5"/> Home</Link>
            <div className="flex items-center gap-2 text-emerald-600"><Plane className="h-5 w-5"/><span className="text-sm font-black">Unique Travel • Flights</span></div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Compare prototype flight options, tune your preferences and prepare your journey first. An account is only needed when you are ready to book or send a request.</p>
          </div>
          {currentUser&&<span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Signed in</span>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {([['domestic','Domestic Flight','Within Nigeria',Plane],['international','International Flight','Across borders',Globe2]] as const).map(([value,label,sub,Icon])=>
          <button key={value} onClick={()=>{update({flightType:value});setError('');setStage('form');}} className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${draft.flightType===value?'border-emerald-500 bg-emerald-50 shadow-sm':'border-slate-200 bg-white'}`}>
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
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-600"/><h2 className="text-sm font-black text-slate-900">Make the journey fit you</h2></div>
          <p className="mt-1 text-xs text-slate-500">Choose what matters most. UniquePlatform uses these preferences to rank prototype options.</p>
          <div className="mt-3 flex flex-wrap gap-2">{preferenceOptions.map(pref=><button key={pref} type="button" onClick={()=>update({preferences:draft.preferences.includes(pref)?draft.preferences.filter(v=>v!==pref):[...draft.preferences,pref]})} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${draft.preferences.includes(pref)?'border-emerald-500 bg-white text-emerald-700':'border-white bg-white/70 text-slate-600'}`}>{pref}</button>)}</div>
          <textarea value={draft.notes} onChange={e=>update({notes:e.target.value})} rows={2} placeholder="Anything else? e.g. 'I prefer a direct morning flight with one checked bag and a window seat.'" className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500"/>
          <label className="mt-3 block text-xs font-bold text-slate-600">Budget (optional)<input value={draft.budget} onChange={e=>update({budget:e.target.value})} placeholder="e.g. ₦250,000" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500"/></label>
        </div>

        {error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button onClick={searchFlights} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"><Search className="h-4 w-4"/> Search flights <ArrowRight className="h-4 w-4"/></button>
          <button onClick={beginRequest} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 hover:border-emerald-300"><CircleHelp className="h-4 w-4 text-emerald-600"/> Send Booking Request</button>
        </div>
      </section>}

      {stage==='results'&&<section className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Prototype flight inventory:</strong> These sample options demonstrate the UniquePlatform booking experience. They are not live airline schedules, fares or reservations.</div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <div><p className="text-sm font-black text-slate-900">{results.length} prototype options</p><p className="text-[11px] text-slate-500">{draft.from} → {draft.to} · {draft.departure} · {draft.passengers} traveller(s)</p></div>
          <div className="flex gap-2"><button onClick={()=>setShowFilters(v=>!v)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><SlidersHorizontal className="h-3.5 w-3.5"/> Filters</button><select value={sort} onChange={e=>setSort(e.target.value as SortMode)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"><option value="recommended">Recommended</option><option value="cheapest">Cheapest</option><option value="fastest">Fastest</option><option value="earliest">Earliest</option></select></div>
        </div>
        {showFilters&&<div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={directOnly} onChange={e=>setDirectOnly(e.target.checked)}/> Direct flights only</label>
          <label className="text-xs font-bold text-slate-600">Maximum budget<input value={maxBudget} onChange={e=>setMaxBudget(e.target.value)} placeholder="e.g. 250000" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/></label>
        </div>}
        {results.map(f=><article key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-950">{f.airline}</span><span className="text-[10px] text-slate-400">{f.flightNo}</span>{f.tag&&<span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{f.tag}</span>}</div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div><p className="text-xl font-black text-slate-950">{f.depart}</p><p className="text-xs text-slate-500">{f.from}</p></div><div className="text-center"><p className="text-[10px] font-bold text-slate-400">{f.duration}</p><div className="my-1 h-px w-16 bg-slate-200"/><p className="text-[10px] font-bold text-emerald-600">{f.stops}</p></div><div className="text-right"><p className="text-xl font-black text-slate-950">{f.arrive}</p><p className="text-xs text-slate-500">{f.to}</p></div></div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1">{f.cabin}</span><span className="rounded-full bg-slate-100 px-2 py-1">{f.baggage} baggage</span><span className="rounded-full bg-slate-100 px-2 py-1">{f.duration}</span></div>
            </div>
            <div className="w-full shrink-0 rounded-xl bg-slate-50 p-3 sm:w-40 sm:text-right"><p className="text-[10px] font-bold text-slate-400">Prototype fare</p><p className="mt-1 text-xl font-black text-slate-950">{f.currency}{money(f.price)}</p><button onClick={()=>chooseFlight(f)} className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white">Select flight</button></div>
          </div>
        </article>)}
        {results.length===0&&<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center"><Filter className="mx-auto h-6 w-6 text-slate-300"/><p className="mt-2 text-sm font-black">No prototype matches yet</p><p className="mt-1 text-xs text-slate-500">Try a broader city name, remove a filter or switch flight type.</p></div>}
        <button onClick={()=>setStage('form')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">← Edit search</button>
        <button onClick={beginRequest} className="ml-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">Need help? Send Booking Request</button>
      </section>}

      {stage==='review'&&<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600"/><h2 className="text-lg font-black text-slate-950">{selectedFlight?'Review selected flight':'Review booking request'}</h2></div>
        {selectedFlight&&<div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{selectedFlight.airline} · {selectedFlight.flightNo}</p><p className="mt-1 text-xs text-slate-600">{selectedFlight.from} → {selectedFlight.to} · {selectedFlight.depart}–{selectedFlight.arrive} · {selectedFlight.stops}</p></div><p className="text-sm font-black">{selectedFlight.currency}{money(selectedFlight.price)}</p></div></div>}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Route',`${draft.from} → ${draft.to}`],['Dates',draft.tripType==='oneway'?draft.departure:`${draft.departure} → ${draft.returnDate}`],['Travellers',draft.passengers],['Cabin',draft.cabin]].map(([a,b])=><div key={a} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{a}</p><p className="mt-1 font-bold text-slate-800">{b}</p></div>)}</div>
        {draft.preferences.length>0&&<div className="mt-4"><p className="text-xs font-black text-slate-700">Trip preferences</p><div className="mt-2 flex flex-wrap gap-2">{draft.preferences.map(p=><span key={p} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{p}</span>)}</div></div>}
        {draft.notes&&<p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><strong>Note:</strong> {draft.notes}</p>}
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">{selectedFlight?'This is a prototype option. Live fare and seat availability must be confirmed by a connected travel provider before any booking is completed.':'Your preferences will travel with the booking request so the travel desk can understand what you need.'}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={()=>{setStage(selectedFlight?'results':'form');setPendingAction(null);}} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Edit details</button><button onClick={continueAction} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{currentUser?'Continue':'Log in / Create account'} <ChevronRight className="h-4 w-4"/></button></div>
      </section>}

      {stage==='ready'&&<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-600"/><div><h2 className="text-lg font-black text-slate-950">Ready for the next step</h2><p className="mt-1 text-sm text-slate-600">{notice}</p></div></div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><strong>{draft.from} → {draft.to}</strong> · {draft.departure} · {draft.passengers} traveller(s) · {draft.cabin}{selectedFlight&&<> · {selectedFlight.airline} · {selectedFlight.flightNo}</>}</div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>{setStage('form');setPendingAction(null);setNotice('')}} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Edit / start another</button>{!currentUser&&<Link to="/login" state={{from:{pathname:'/flights'}}} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><LogIn className="mr-1 inline h-4 w-4"/> Log in</Link>}</div>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600"/><p><strong className="text-slate-700">Prototype / live-data rule:</strong> UniquePlatform does not present these sample flights as real airline inventory. Live schedules, fares, seats, booking confirmation and travel-desk submission will only appear when connected providers or office systems supply them.</p></div></section>
    </div>
  </div>;
}
