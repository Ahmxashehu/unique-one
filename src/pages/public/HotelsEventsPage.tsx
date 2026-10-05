import { useMemo, useState } from 'react';
import {
  Building2, CalendarDays, Car, CheckCircle2, ChevronRight, Coffee,
  MapPin, Search, Sparkles, Star, Users, Utensils, Waves
} from 'lucide-react';

type Mode = 'stay' | 'meet' | 'celebrate' | 'dine' | 'experience' | 'move';

const modes: Array<{id: Mode; label: string; sub: string; icon: typeof Building2}> = [
  { id: 'stay', label: 'Stay', sub: 'Hotels & rooms', icon: Building2 },
  { id: 'meet', label: 'Meet', sub: 'Conference & meetings', icon: Users },
  { id: 'celebrate', label: 'Celebrate', sub: 'Events & venues', icon: Sparkles },
  { id: 'dine', label: 'Dine', sub: 'Restaurants & catering', icon: Utensils },
  { id: 'experience', label: 'Experience', sub: 'Spa · pool · activities', icon: Waves },
  { id: 'move', label: 'Move', sub: 'Airport · car · driver', icon: Car },
];

const hotels = [
  { name: 'Capital View Hotel', location: 'Maitama, Abuja', rating: '4.7', price: '₦120,000', services: ['Stay', 'Conference', 'Dining'] },
  { name: 'City Grand Hotel', location: 'Central Area, Abuja', rating: '4.6', price: '₦95,000', services: ['Stay', 'Events', 'Dining'] },
  { name: 'Lakeside Resort & Events', location: 'Abuja', rating: '4.8', price: '₦150,000', services: ['Stay', 'Events', 'Experience'] },
];

const venues = [
  { name: 'Grand Conference Hall', location: 'Maitama, Abuja', capacity: 500, price: '₦400,000/day', extras: 'Projector · Wi-Fi · Parking · Catering' },
  { name: 'Executive Boardroom', location: 'Central Area, Abuja', capacity: 20, price: '₦120,000/day', extras: 'Screen · Wi-Fi · Refreshments' },
  { name: 'Garden Events Pavilion', location: 'Abuja', capacity: 350, price: '₦300,000/day', extras: 'Parking · Catering · Outdoor space' },
];

export default function HotelsEventsPage() {
  const [mode, setMode] = useState<Mode>('stay');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('Abuja, FCT');
  const [showPlanner, setShowPlanner] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filteredHotels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter((h) => [h.name, h.location, ...h.services].some((v) => v.toLowerCase().includes(q)));
  }, [search]);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) => [v.name, v.location, v.extras].some((x) => x.toLowerCase().includes(q)));
  }, [search]);

  const selectService = (name: string) => {
    setSelected(name);
    setMessage(`${name} selected. Live provider availability will be connected here; this prototype does not invent availability.`);
  };

  return (
    <main className="min-h-screen bg-[#f7f9f8] pb-14 text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <header className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-5 text-white shadow-xl">
          <div className="flex items-center gap-2 text-emerald-200 text-sm font-bold">
            <Building2 className="h-4 w-4" /> Unique Hotels & Events Network
          </div>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Find a place. Plan an experience. Book everything.</h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-50/80">Hotels, conference halls, event venues and hospitality services in one connected experience.</p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur">
            <Search className="ml-2 h-5 w-5 shrink-0 text-emerald-200" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hotel, venue, service or location" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-white/55" />
            <div className="hidden items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold sm:flex"><MapPin className="h-3.5 w-3.5" />{location}</div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden">
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><MapPin className="mr-1 inline h-3 w-3" />{location}</span>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">My Bookings</span>
          </div>
        </header>

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between">
            <div><h2 className="text-lg font-black">What are you looking for?</h2><p className="text-xs text-slate-500">Choose a service to explore the prototype.</p></div>
            <button className="hidden text-xs font-bold text-emerald-700 sm:block">My Bookings</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {modes.map(({ id, label, sub, icon: Icon }) => (
              <button key={id} onClick={() => { setMode(id); setMessage(''); }} className={`rounded-2xl border p-3 text-left transition ${mode === id ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                <Icon className={`h-5 w-5 ${mode === id ? 'text-emerald-700' : 'text-slate-500'}`} />
                <div className="mt-2 text-sm font-black">{label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <button onClick={() => setShowPlanner((v) => !v)} className="flex w-full items-center justify-between text-left">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Sparkles className="h-5 w-5" /></span><span><span className="block text-sm font-black">Planning something?</span><span className="block text-xs text-slate-500">Let Unique One help combine venue, stay, catering and transport.</span></span></div>
            <ChevronRight className={`h-5 w-5 transition ${showPlanner ? 'rotate-90' : ''}`} />
          </button>
          {showPlanner && (
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <select className="rounded-xl border border-slate-200 p-3 text-sm"><option>Conference</option><option>Wedding</option><option>Birthday</option><option>Training</option><option>Corporate meeting</option></select>
              <input placeholder="Guests e.g. 250" type="number" min="1" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input type="date" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <button onClick={() => setMessage('Event planning prototype ready. Matching will use live provider availability when connected.')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Find matches</button>
            </div>
          )}
        </section>

        {mode === 'stay' && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-black">Featured Hotels & Partners</h2><p className="text-xs text-slate-500">Prototype network — provider inventory will become live as partners connect.</p></div></div>
            <div className="grid gap-3 md:grid-cols-3">
              {filteredHotels.map((hotel) => <article key={hotel.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="h-28 bg-gradient-to-br from-emerald-100 via-slate-100 to-emerald-200 p-3"><span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-emerald-800">HOTEL NETWORK</span></div><div className="p-4"><div className="flex justify-between gap-2"><div><h3 className="font-black">{hotel.name}</h3><p className="mt-1 text-xs text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />{hotel.location}</p></div><span className="text-xs font-black"><Star className="mr-0.5 inline h-3 w-3 fill-current text-amber-500" />{hotel.rating}</span></div><p className="mt-3 text-sm font-black">From {hotel.price}<span className="text-xs font-normal text-slate-500"> / night</span></p><div className="mt-3 flex flex-wrap gap-1">{hotel.services.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{s}</span>)}</div><button onClick={() => selectService(hotel.name)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-black text-white">View hotel <ChevronRight className="h-4 w-4" /></button></div></article>)}</div>
          </section>
        )}

        {(mode === 'meet' || mode === 'celebrate') && (
          <section className="mt-6">
            <h2 className="text-lg font-black">{mode === 'meet' ? 'Conference & Meeting Spaces' : 'Event Venues'}</h2>
            <p className="mt-1 text-xs text-slate-500">Compare capacity, facilities and prototype pricing before live providers are connected.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">{filteredVenues.map((venue) => <article key={venue.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Building2 className="h-5 w-5" /></span><span className="text-xs font-bold text-slate-500">{venue.capacity} guests</span></div><h3 className="mt-3 font-black">{venue.name}</h3><p className="mt-1 text-xs text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />{venue.location}</p><p className="mt-3 text-sm font-black">{venue.price}</p><p className="mt-1 text-xs text-slate-500">{venue.extras}</p><button onClick={() => selectService(venue.name)} className="mt-4 w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black text-white">Check booking</button></article>)}</div>
          </section>
        )}

        {mode === 'dine' && <PrototypeService title="Dining & Catering" icon={<Utensils className="h-5 w-5" />} items={['Hotel restaurant', 'Breakfast & buffet', 'Private dining', 'Event catering']} onSelect={selectService} />}
        {mode === 'experience' && <PrototypeService title="Hotel Experiences" icon={<Waves className="h-5 w-5" />} items={['Swimming pool', 'Gym & fitness', 'Spa & wellness', 'Family activities']} onSelect={selectService} />}
        {mode === 'move' && <PrototypeService title="Hospitality Transport" icon={<Car className="h-5 w-5" />} items={['Airport pickup', 'Car hire', 'Driver service', 'Local transfers']} onSelect={selectService} />}

        {message && <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></div>}

        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          <Info icon={<CalendarDays className="h-5 w-5" />} title="Book in one flow" text="Stay, halls, events and services can become one booking." />
          <Info icon={<Coffee className="h-5 w-5" />} title="Hotel network" text="Each provider can publish rooms, halls, dining and experiences." />
          <Info icon={<CheckCircle2 className="h-5 w-5" />} title="Verified providers" text="Live availability and prices will come from connected providers." />
        </section>
      </div>
    </main>
  );
}

function PrototypeService({ title, icon, items, onSelect }: { title: string; icon: React.ReactNode; items: string[]; onSelect: (name: string) => void }) {
  return <section className="mt-6"><div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="text-xs text-slate-500">Prototype services ready for provider integration.</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <button key={item} onClick={() => onSelect(item)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300"><span className="text-sm font-black">{item}</span><span className="mt-2 block text-xs text-slate-500">Explore service <ChevronRight className="inline h-3 w-3" /></span></button>)}</div></section>;
}

function Info({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-emerald-700">{icon}</span><h3 className="mt-2 text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}
