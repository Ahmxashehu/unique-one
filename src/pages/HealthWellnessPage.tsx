import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarClock, ChevronRight, CircleAlert, FileText, HeartPulse, Hospital, MapPin, Pill, Search, ShieldCheck, Stethoscope, UserRound, Video, X } from 'lucide-react';

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
  const [message, setMessage] = useState('');

  const open = (next: HealthMode) => { setMode(next); setMessage(''); };
  const back = () => { setMode(null); setMessage(''); };
  const checkProviders = () => {
    if (mode === 'nearby' && !area.trim()) {
      setMessage('Enter your city or area to prepare a provider search. No search has been submitted.');
      return;
    }
    setMessage('No connected verified healthcare provider service is available here yet. No consultation, prescription, appointment, or request has been submitted.');
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Unique Health & Wellness">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center py-3 sm:py-8">
        <section className="w-full overflow-hidden rounded-[30px] border border-white/30 bg-white/95 shadow-[0_25px_100px_rgba(0,0,0,.34)] backdrop-blur-2xl">
          <header className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 px-4 py-5 text-white sm:px-6 sm:py-6">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10"><HeartPulse className="h-4 w-4" /></span><span className="text-xs font-black uppercase tracking-[0.16em]">Unique Health & Wellness</span></div>
                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Find care • Consult • Get medicines • Stay well</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-300">Healthcare discovery for verified providers. Provider search, appointments and prescription fulfilment are unavailable until the real healthcare integrations are connected and tested.</p>
              </div>
              <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
          </header>
          <div className="p-3 sm:p-5">
            {mode === null ? (
              <>
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="text-sm font-black text-amber-950">Live healthcare services are not available yet</h2><p className="mt-1 text-xs leading-5 text-amber-900">The previous screen included placeholder pharmacy names and non-submitting actions. Those have been removed. No healthcare provider, medicine stock, price or appointment availability is being represented as real.</p></div></div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {options.map(([value, Icon, label, description]) => <button key={value} type="button" onClick={() => open(value)} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span><span className="mt-2 block text-xs font-black text-slate-900">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</span></button>)}
                </div>
                <section className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-4"><h2 className="font-black text-red-900">Emergency care</h2><p className="mt-2 text-sm leading-6 text-red-800">For an immediate emergency, contact local emergency services or go to the nearest emergency facility. Do not wait for this app to connect a provider.</p></section>
              </>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <button type="button" onClick={back} className="mb-4 inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><ChevronRight className="h-3.5 w-3.5 rotate-180" /> All health services</button>
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><HeartPulse className="h-5 w-5" /></span><div><h2 className="font-black text-slate-950">{options.find(([value]) => value === mode)?.[2]}</h2><p className="mt-1 text-sm text-slate-500">{options.find(([value]) => value === mode)?.[3]}</p></div></div>
                {mode === 'emergency' ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">For an immediate emergency, contact local emergency services or go to the nearest emergency facility. No live emergency dispatch is connected here.</div> : (
                  <>
                    {mode === 'nearby' && <label className="mt-4 block text-xs font-bold text-slate-600">City or area<input value={area} onChange={e => setArea(e.target.value)} placeholder="Enter city or area" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>}
                    {mode === 'prescription' && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Prescription file upload and pharmacist review are not connected yet. Do not enter or send sensitive prescription details through this placeholder.</p>}
                    <button type="button" onClick={checkProviders} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"><Search className="h-4 w-4" /> Check service availability</button>
                  </>
                )}
                {message && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{message}</p>}
                {mode === 'requests' && <p className="mt-3 text-xs leading-5 text-slate-500">Health request tracking will appear when authenticated healthcare request storage is implemented and verified.</p>}
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
