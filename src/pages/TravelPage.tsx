import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Hotel, MapPinned, CalendarDays, Search, ShieldCheck, WalletCards, Car, BusFront, UserRound, Map, Ticket, UtensilsCrossed, UsersRound, Bookmark, BriefcaseBusiness, X, ArrowLeft, Navigation, Clock3 } from 'lucide-react';

type TravelMode = 'flights' | 'car' | 'bus' | 'hire' | 'stays' | 'activities' | 'destinations' | 'plan' | 'trips' | 'saved' | 'group' | 'nearby';

const travelOptions: Array<[TravelMode, typeof Plane, string, string]> = [
  ['flights', Plane, 'Flights', 'Book air travel'],
  ['car', Car, 'Travel by Car', 'Road rides & trips'],
  ['bus', BusFront, 'Bus & Coach', 'Seats & schedules'],
  ['hire', UserRound, 'Car Hire', 'Vehicle + driver'],
  ['stays', Hotel, 'Hotels & Stays', 'Rooms & accommodation'],
  ['activities', Ticket, 'Activities', 'Things to do'],
  ['destinations', Map, 'Destinations', 'Discover places'],
  ['plan', CalendarDays, 'Plan My Trip', 'Build an itinerary'],
  ['trips', MapPinned, 'My Trips', 'Bookings & itineraries'],
  ['saved', Bookmark, 'Saved Places', 'Your favourites'],
  ['group', UsersRound, 'Group Travel', 'Travel together'],
  ['nearby', Navigation, 'Nearby Travel', 'Around you'],
  ['nearby', BriefcaseBusiness, 'Travel Services', 'Providers & professionals'],
];

export default function TravelPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TravelMode | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departure, setDeparture] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [guests, setGuests] = useState('1');
  const [message, setMessage] = useState('');
  const [carType, setCarType] = useState('Shared ride');

  const title = useMemo(() => ({
    flights: 'Book a flight', car: 'Travel by Car', bus: 'Bus & Coach', hire: 'Car Hire & Driver',
    stays: 'Hotels & Stays', activities: 'Activities & Experiences', destinations: 'Discover destinations',
    plan: 'Plan My Trip', trips: 'My Trips', saved: 'Saved Places', group: 'Group Travel', nearby: 'Nearby Travel',
  } as Record<TravelMode, string>), []);

  const openMode = (nextMode: TravelMode) => {
    setMode(nextMode);
    setMessage('');
  };

  const submit = () => {
    if (['flights', 'car', 'bus', 'hire'].includes(mode || '') && (!from.trim() || !to.trim() || !departure)) {
      setMessage('Enter your origin, destination, and departure date.');
      return;
    }
    if (mode === 'stays' && (!to.trim() || !departure)) {
      setMessage('Enter a destination and check-in date.');
      return;
    }
    setMessage('Live travel-provider search is not connected yet. No availability was checked, no price was quoted, and no booking or request was submitted.');
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Unique Travel">
      <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center py-3 sm:py-8">
        <section className="w-full overflow-hidden rounded-[28px] border border-white/30 bg-white/95 shadow-[0_25px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <header className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-4 py-5 text-white sm:px-6 sm:py-6">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                    <Plane className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.16em]">Unique Travel</span>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Plan • Book • Travel • Track</h1>
                <p className="mt-1 max-w-xl text-sm text-slate-300">Everything for your journey, without leaving the screen.</p>
              </div>
              <button type="button" onClick={() => navigate(-1)} aria-label="Close Unique Travel" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="p-3 sm:p-5">
            {mode === null ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="text-sm font-black text-slate-900">Where would you like to go?</p>
                    <p className="text-xs text-slate-500">Choose an experience to continue.</p>
                  </div>
                  <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 sm:block">Smart travel hub</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {travelOptions.map(([value, Icon, label, description], index) => (
                    <button
                      key={`${value}-${label}-${index}`}
                      type="button"
                      onClick={() => openMode(value)}
                      className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md active:scale-[0.98] sm:p-4"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100 sm:h-10 sm:w-10">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="mt-2 block truncate text-xs font-black text-slate-900 sm:text-sm">{label}</span>
                      <span className="mt-0.5 block line-clamp-1 text-[10px] text-slate-500 sm:text-xs">{description}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => { setMode(null); setMessage(''); }} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <ArrowLeft className="h-3.5 w-3.5" /> All travel
                  </button>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{title[mode]}</p>
                    <p className="text-[10px] text-slate-500">Unique Travel</p>
                  </div>
                </div>

                {['trips', 'saved', 'group', 'nearby'].includes(mode) ? (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                        {mode === 'saved' ? <Bookmark className="h-5 w-5" /> : mode === 'group' ? <UsersRound className="h-5 w-5" /> : mode === 'nearby' ? <Navigation className="h-5 w-5" /> : <MapPinned className="h-5 w-5" />}
                      </span>
                      <div>
                        <h2 className="font-black text-slate-900">{title[mode]}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {mode === 'saved' ? 'Keep destinations, stays, activities and travel options you want to revisit.' :
                           mode === 'group' ? 'Plan a shared journey with family, friends or colleagues.' :
                           mode === 'nearby' ? 'Discover nearby transport, stays, dining and experiences.' :
                           'Your confirmed bookings and itineraries will appear here.'}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    {['flights', 'car', 'bus', 'hire'].includes(mode) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-slate-600">From<input value={from} onChange={e => setFrom(e.target.value)} placeholder="City or airport" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
                        <label className="text-xs font-bold text-slate-600">To<input value={to} onChange={e => setTo(e.target.value)} placeholder="City or airport" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
                      </div>
                    )}
                    {mode === 'stays' && (
                      <label className="block text-xs font-bold text-slate-600">Destination<input value={to} onChange={e => setTo(e.target.value)} placeholder="City, region, or landmark" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
                    )}
                    {mode === 'car' && (
                      <label className="block text-xs font-bold text-slate-600">Travel type<select value={carType} onChange={e => setCarType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal">
                        <option>Shared ride</option><option>Private car + driver</option><option>Self-drive rental</option><option>Road trip</option>
                      </select></label>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-600">Departure / check-in<input type="date" value={departure} onChange={e => setDeparture(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
                      <label className="text-xs font-bold text-slate-600">{mode === 'flights' ? 'Return date' : 'Check-out'}<input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
                    </div>
                    <label className="block text-xs font-bold text-slate-600">Travellers / guests<input type="number" min="1" value={guests} onChange={e => setGuests(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
                    {(mode === 'plan' || mode === 'activities' || mode === 'destinations') && (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Live provider data is not connected for this experience. This action cannot return real availability, pricing or a booking.</div>
                    )}
                    <button type="button" onClick={submit} className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto">
                      <span className="inline-flex items-center justify-center gap-2"><Search className="h-4 w-4" /> Search travel</span>
                    </button>
                    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{message}</div>}
                  </section>
                )}
              </>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /><span className="text-[10px] font-bold text-slate-600">Verified providers</span></div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><WalletCards className="h-4 w-4 shrink-0 text-indigo-600" /><span className="text-[10px] font-bold text-slate-600">UniquePay ready</span></div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><Clock3 className="h-4 w-4 shrink-0 text-amber-600" /><span className="text-[10px] font-bold text-slate-600">One itinerary</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
