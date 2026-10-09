import { useState } from 'react';
import { ArrowLeft, Building2, CalendarDays, Car, CircleAlert, Coffee, MapPin, Search, ShieldCheck, Sparkles, Utensils, Users, Waves } from 'lucide-react';

type Mode = 'stay' | 'meet' | 'celebrate' | 'dine' | 'experience' | 'move';

const modes: Array<{ id: Mode; label: string; description: string; icon: typeof Building2 }> = [
  { id: 'stay', label: 'Hotels & rooms', description: 'Hotels, rooms and accommodation', icon: Building2 },
  { id: 'meet', label: 'Meetings', description: 'Conference halls and meeting rooms', icon: Users },
  { id: 'celebrate', label: 'Events & venues', description: 'Weddings, parties and venues', icon: Sparkles },
  { id: 'dine', label: 'Dining & catering', description: 'Restaurants and catering', icon: Utensils },
  { id: 'experience', label: 'Experiences', description: 'Spa, pools and activities', icon: Waves },
  { id: 'move', label: 'Hospitality transport', description: 'Airport pickup, cars and drivers', icon: Car },
];

export default function HotelsEventsPage() {
  const [mode, setMode] = useState<Mode>('stay');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('1');
  const [message, setMessage] = useState('');

  const selectedMode = modes.find(item => item.id === mode) ?? modes[0];
  const Icon = selectedMode.icon;

  const checkAvailability = () => {
    setMessage('Live verified provider availability is not connected yet. No booking, reservation, or service request has been submitted.');
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5 pb-10">
        <header className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-5 text-white shadow-xl sm:p-7">
          <button type="button" onClick={() => window.history.back()} className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-center gap-2 text-emerald-200 text-sm font-bold"><Building2 className="h-4 w-4" /> Unique Hotels & Events</div>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Find a place. Plan an experience.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">Explore hospitality categories. Only verified provider listings, live availability and confirmed prices can be used for real bookings.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Hospitality categories">
          {modes.map(item => {
            const ItemIcon = item.icon;
            return <button key={item.id} type="button" onClick={() => { setMode(item.id); setMessage(''); }} aria-pressed={mode === item.id} className={`rounded-2xl border p-4 text-left transition ${mode === item.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><ItemIcon className="h-5 w-5" /></span>
              <span className="mt-3 block text-sm font-black">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
            </button>;
          })}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><CircleAlert className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black">Live booking is not available yet</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">The previous page displayed fictional hotels, venues, prices and inventory. Those samples have been removed. We will show bookable options only after verified providers connect their actual inventory.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4 text-emerald-700" /> Search {selectedMode.label.toLowerCase()}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">Destination or area
                <span className="relative mt-1 block"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={destination} onChange={e => setDestination(e.target.value)} placeholder="City, area or venue location" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm font-normal outline-none focus:border-emerald-500" /></span>
              </label>
              <label className="text-xs font-bold text-slate-600">Date
                <span className="relative mt-1 block"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm font-normal outline-none focus:border-emerald-500" /></span>
              </label>
              <label className="text-xs font-bold text-slate-600">Guests or attendees
                <span className="relative mt-1 block"><Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="number" min="1" value={guests} onChange={e => setGuests(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm font-normal outline-none focus:border-emerald-500" /></span>
              </label>
            </div>
            <button type="button" onClick={checkAvailability} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"><Search className="h-4 w-4" /> Check live availability</button>
            {message && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{message}</p>}
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <p className="text-xs leading-5 text-slate-600">No real hotel, venue, room, event, transport provider, price or availability is currently being advertised on this page. Search inputs are not submitted to a booking service.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
