import { useMemo, useState } from 'react';
import { Plane, Hotel, MapPinned, CalendarDays, Search, ShieldCheck, WalletCards } from 'lucide-react';

type TravelMode = 'flights' | 'stays' | 'trips';

export default function TravelPage() {
  const [mode, setMode] = useState<TravelMode>('flights');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departure, setDeparture] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [guests, setGuests] = useState('1');
  const [message, setMessage] = useState('');

  const title = useMemo(() => mode === 'flights' ? 'Find your next journey' : mode === 'stays' ? 'Find a place to stay' : 'Plan and manage your trips', [mode]);

  const submit = () => {
    if (mode === 'flights' && (!from.trim() || !to.trim() || !departure)) {
      setMessage('Enter your origin, destination, and departure date.');
      return;
    }
    if (mode === 'stays' && (!to.trim() || !departure)) {
      setMessage('Enter a destination and check-in date.');
      return;
    }
    setMessage('Travel search is ready for live provider integration. No availability or price has been invented.');
  };

  return (
    <div className="space-y-6 pb-12">
      <header>
        <div className="flex items-center gap-2 text-emerald-600">
          <Plane className="w-6 h-6" />
          <span className="text-sm font-semibold">Unique Travel</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">Search, plan, book, and manage travel from one place.</p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['flights', Plane, 'Flights'],
          ['stays', Hotel, 'Stays'],
          ['trips', MapPinned, 'My Trips'],
        ].map(([value, Icon, label]) => (
          <button key={value as string} onClick={() => { setMode(value as TravelMode); setMessage(''); }}
            className={`rounded-xl border p-3 text-sm font-medium flex items-center justify-center gap-2 ${mode === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            <Icon className="w-4 h-4" />{label as string}
          </button>
        ))}
      </div>

      {mode !== 'trips' ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {mode === 'flights' && (
              <>
                <label className="text-sm text-slate-600">From<input value={from} onChange={e => setFrom(e.target.value)} placeholder="City or airport" className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500" /></label>
                <label className="text-sm text-slate-600">To<input value={to} onChange={e => setTo(e.target.value)} placeholder="City or airport" className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500" /></label>
              </>
            )}
            {mode === 'stays' && (
              <label className="text-sm text-slate-600 md:col-span-2">Destination<input value={to} onChange={e => setTo(e.target.value)} placeholder="City, region, or landmark" className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500" /></label>
            )}
            <label className="text-sm text-slate-600">Check-in / departure<input type="date" value={departure} onChange={e => setDeparture(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500" /></label>
            <label className="text-sm text-slate-600">{mode === 'flights' ? 'Return date' : 'Check-out'}<input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500" /></label>
            <label className="text-sm text-slate-600">Travellers / guests<input type="number" min="1" value={guests} onChange={e => setGuests(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500" /></label>
          </div>
          <button onClick={submit} className="w-full sm:w-auto rounded-xl bg-emerald-600 text-white px-5 py-3 font-medium flex items-center justify-center gap-2"><Search className="w-4 h-4" /> Search travel</button>
          {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}
        </section>
      ) : (
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-2xl p-5"><CalendarDays className="w-6 h-6 text-emerald-600" /><h2 className="font-semibold mt-3">Trips</h2><p className="text-sm text-slate-500 mt-1">Your confirmed travel plans will appear here once live travel providers are connected.</p></div>
          <div className="bg-white border rounded-2xl p-5"><MapPinned className="w-6 h-6 text-indigo-600" /><h2 className="font-semibold mt-3">Itinerary</h2><p className="text-sm text-slate-500 mt-1">Flights, stays, transfers, and activities can be organized into one itinerary.</p></div>
        </section>
      )}

      <section className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-5"><ShieldCheck className="w-5 h-5 text-emerald-600" /><h3 className="font-semibold mt-3">Verified providers</h3><p className="text-xs text-slate-500 mt-1">Provider availability and booking status must come from connected travel partners.</p></div>
        <div className="bg-white border rounded-2xl p-5"><WalletCards className="w-5 h-5 text-indigo-600" /><h3 className="font-semibold mt-3">UniquePay</h3><p className="text-xs text-slate-500 mt-1">Travel payments will use the existing secure UniquePay flow when enabled.</p></div>
        <div className="bg-white border rounded-2xl p-5"><MapPinned className="w-5 h-5 text-amber-600" /><h3 className="font-semibold mt-3">One itinerary</h3><p className="text-xs text-slate-500 mt-1">Keep journey details together instead of splitting them across services.</p></div>
      </section>
    </div>
  );
}
