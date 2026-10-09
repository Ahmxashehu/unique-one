import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CircleAlert, Plane, ShieldCheck } from 'lucide-react';

export default function FlightsPage() {
  return (
    <main className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5 pb-10">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-2 text-emerald-600">
            <Plane className="h-5 w-5" />
            <span className="text-sm font-black">Unique Travel • Flights</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Flight tickets
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            We will show bookable flights only when a verified travel supplier provides current
            schedules, fares and availability. We do not display invented airline listings or
            sample fares as real offers.
          </p>
        </header>

        <section
          aria-labelledby="flight-status-title"
          className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <CircleAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="flight-status-title" className="text-lg font-black text-slate-950">
                Live flight booking is not available yet
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The live airline or booking-aggregator connection has not been verified. Searching,
                payment, booking confirmation and ticket issuance are therefore unavailable here
                until the real integration is implemented and tested.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <CalendarClock className="h-5 w-5 text-slate-600" />
              <h3 className="mt-2 text-sm font-black text-slate-900">What is being prepared</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Domestic and international search, passenger details, live fare validation and
                booking lifecycle support.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ShieldCheck className="h-5 w-5 text-slate-600" />
              <h3 className="mt-2 text-sm font-black text-slate-900">Payment and ticket safety</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                No flight payment will be requested here until the fare, supplier booking status
                and ticket-issuance flow can be verified end to end.
              </p>
            </div>
          </div>

          <p className="mt-5 rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">
            No reservation or booking request has been submitted. Please do not treat this page as
            a ticket, reservation, fare quote or confirmation.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
          >
            Return to UniquePlatform
          </Link>
        </section>
      </div>
    </main>
  );
}
