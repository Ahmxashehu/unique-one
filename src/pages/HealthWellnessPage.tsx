import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, CalendarClock, ChevronRight, Clock3, FileText, HeartPulse, Hospital, MapPin, Pill, Search, ShieldCheck, Stethoscope, UserRound, Video, X } from 'lucide-react';

type HealthMode = 'nearby' | 'consult' | 'pharmacies' | 'prescription' | 'labs' | 'dental' | 'eye' | 'wellness' | 'emergency' | 'requests';
const options: Array<[HealthMode, typeof Hospital, string, string]> = [
  ['nearby', Hospital, 'Hospitals & Clinics', 'Find care close to you'],
  ['consult', Stethoscope, 'Consult a Doctor', 'Request a consultation'],
  ['pharmacies', Pill, 'Pharmacies', 'Discover pharmacy services'],
  ['prescription', FileText, 'Prescription Order', 'Send a valid prescription'],
  ['labs', Activity, 'Labs & Diagnostics', 'Find diagnostic services'],
  ['dental', HeartPulse, 'Dental Care', 'Find dental providers'],
  ['eye', Search, 'Eye Care', 'Find eye-care providers'],
  ['wellness', Activity, 'Wellness', 'Fitness, nutrition & wellness'],
  ['emergency', ShieldCheck, 'Emergency Care', 'Access emergency providers'],
  ['requests', CalendarClock, 'My Health Requests', 'Track health requests'],
];

export default function HealthWellnessPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<HealthMode | null>(null);
  const [area, setArea] = useState('');
  const [consultType, setConsultType] = useState('General consultation');
  const [consultMode, setConsultMode] = useState('Video');
  const [message, setMessage] = useState('');
  const open = (next: HealthMode) => { setMode(next); setMessage(''); };
  const back = () => { setMode(null); setMessage(''); };
  const action = () => {
    if (mode === 'nearby' && !area.trim()) { setMessage('Enter your city or area so verified providers can be searched.'); return; }
    setMessage('Live healthcare-provider search is not connected yet. No provider was contacted, prescription was sent, appointment was booked, or price/availability checked.');
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Unique Health & Wellness">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center py-3 sm:py-8">
        <section className="w-full overflow-hidden rounded-[30px] border border-white/30 bg-white/95 shadow-[0_25px_100px_rgba(0,0,0,.34)] backdrop-blur-2xl">
          <header className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 px-4 py-5 text-white sm:px-6 sm:py-6">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10"><HeartPulse className="h-4 w-4" /></span><span className="text-xs font-black uppercase tracking-[0.16em]">Unique Health & Wellness</span></div>
                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Find care • Consult • Get medicines • Stay well</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-300">A smart healthcare discovery hub connecting people with verified providers when live services are available.</p>
              </div>
              <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
          </header>
          <div className="p-3 sm:p-5">
            {mode === null ? (
              <>
                <div className="mb-3 grid gap-3 sm:grid-cols-[1.4fr_.9fr]">
                  <button type="button" onClick={() => open('nearby')} className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm"><MapPin className="h-5 w-5" /></span><ChevronRight className="h-5 w-5 text-emerald-600 transition group-hover:translate-x-1" /></div>
                    <p className="mt-3 text-base font-black text-emerald-950">Care Near You</p><p className="mt-1 text-xs leading-5 text-emerald-800">Hospitals • Clinics • Pharmacies • Labs</p><span className="mt-3 inline-flex rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white">Find nearby care</span>
                  </button>
                  <button type="button" onClick={() => open('consult')} className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-left text-white shadow-sm"><div className="flex items-center gap-2"><Video className="h-5 w-5 text-emerald-300" /><span className="text-xs font-black uppercase tracking-wider text-emerald-300">Consultation</span></div><p className="mt-3 text-base font-black">Talk to a healthcare professional</p><p className="mt-1 text-xs leading-5 text-slate-300">Video • Voice • In-person</p></button>
                </div>
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm"><p className="text-sm font-black text-amber-950">Pharmacy integration unavailable</p><p className="mt-1 text-xs leading-5 text-amber-900">No verified pharmacy directory is connected, so provider services and prescription fulfilment cannot be offered yet.</p></div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {options.map(([value, Icon, label, description]) => <button key={value} type="button" onClick={() => open(value)} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span><span className="mt-2 block text-xs font-black text-slate-900">{label}</span><span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-slate-500">{description}</span></button>)}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={back} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> All health</button><div className="text-right"><p className="text-sm font-black text-slate-900">{options.find(([v]) => v === mode)?.[2]}</p><p className="text-[10px] text-slate-500">Unique Health & Wellness</p></div></div>
                {mode === 'pharmacies' ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-black text-amber-950">Verified pharmacy listings unavailable</h2><p className="mt-2 text-sm leading-6 text-amber-900">No live pharmacy directory is connected. We have removed fictional provider cards and cannot accept or route prescriptions until a verified pharmacy integration is available.</p></div></div></div>
                ) : mode === 'prescription' ? (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-black text-amber-950">Prescription submission unavailable</h2><p className="mt-2 text-sm leading-6 text-amber-900">No verified pharmacy endpoint is connected. Prescription upload and routing are disabled here; do not submit prescription documents until the secure provider workflow is available.</p></div></div></section>
                
                ) : mode === 'consult' ? (
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Consultation type<select value={consultType} onChange={e => setConsultType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option>General consultation</option><option>Specialist</option><option>Child health</option><option>Women's health</option><option>Dental</option><option>Eye care</option><option>Mental wellness</option></select></label><label className="text-xs font-bold text-slate-600">Consultation mode<select value={consultMode} onChange={e => setConsultMode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option>Video</option><option>Voice</option><option>In-person</option></select></label></div><button type="button" onClick={action} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Find verified providers</button></section>
                ) : mode === 'nearby' ? (
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-xs font-bold text-slate-600">City / area<input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Abuja, Wuse, Garki..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><span className="rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600">Hospitals</span><span className="rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600">Clinics</span><span className="rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600">Pharmacies</span><span className="rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600">Labs</span></div><button type="button" onClick={action} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Search nearby care</button></section>
                ) : mode === 'emergency' ? (
                  <section className="rounded-2xl border border-red-100 bg-red-50 p-5"><h2 className="font-black text-red-900">Emergency care</h2><p className="mt-2 text-sm leading-6 text-red-800">For an immediate emergency, contact local emergency services or go to the nearest emergency facility. This feature will surface verified providers when connected.</p></section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-3"><UserRound className="h-6 w-6 text-emerald-600" /><div><h2 className="font-black">{options.find(([v]) => v === mode)?.[2]}</h2><p className="mt-1 text-sm text-slate-500">Live verified-provider search is not connected. This action cannot return real availability, prices, appointments, prescriptions, or medical advice.</p></div></div><button type="button" onClick={action} className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Continue</button></section>
                )}
                {message && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{message}</div>}
              </>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><ShieldCheck className="h-4 w-4 text-emerald-600" /><span className="text-[10px] font-bold text-slate-600">Provider directory unavailable</span></div><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><Pill className="h-4 w-4 text-emerald-600" /><span className="text-[10px] font-bold text-slate-600">Pharmacy fulfilment unavailable</span></div><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><Clock3 className="h-4 w-4 text-amber-600" /><span className="text-[10px] font-bold text-slate-600">Request tracking not connected</span></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}