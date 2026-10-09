import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, CalendarDays, Car, CircleAlert, Coffee, ShieldCheck,
  Sparkles, Utensils, Users, Waves,
} from 'lucide-react';

const experiences = [
  { label: 'Stay', description: 'Hotels, rooms and resorts', icon: Building2 },
  { label: 'Meet', description: 'Conference and meeting venues', icon: Users },
  { label: 'Celebrate', description: 'Event spaces and venues', icon: Sparkles },
  { label: 'Dine', description: 'Dining and catering', icon: Utensils },
  { label: 'Experience', description: 'Spa, pool and activities', icon: Waves },
  { label: 'Move', description: 'Airport transfers and drivers', icon: Car },
];

export default function HotelsEventsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-5 text-white shadow-lg sm:p-7">
          <Link to="/" className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-emerald-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <div className="flex items-center gap-2 text-emerald-200">
            <Building2 className="h-5 w-5" />
            <span className="text-sm font-black">Unique Hotels & Events</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Hotels, venues and hospitality</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">
            Explore the types of hospitality services planned for UniquePlatform. We only list properties,
            availability and prices after verified providers supply real inventory.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <CircleAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">Live hotel and event booking is unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                No verified accommodation or venue inventory integration has been confirmed. Fictional
                hotel names, ratings, room options, capacities and prices have been removed. No search,
                reservation or booking request can be submitted from this page yet.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map(({ label, description, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-black">{label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Booking will be enabled after verified partners provide live inventory, date availability, final pricing, cancellation rules and a tested confirmation flow.</p>
          </div>
          <Link to="/" className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
            Return to UniquePlatform
          </Link>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            <h3 className="mt-2 text-sm font-black">Dates and reservations</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Date selection will be available when live provider calendars can confirm inventory.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <Coffee className="h-5 w-5 text-slate-500" />
            <h3 className="mt-2 text-sm font-black">Catering and transport</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Hospitality add-ons will be offered only when a verified provider supports them.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
