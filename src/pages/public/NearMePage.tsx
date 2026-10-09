import { MapPin, ShieldCheck } from 'lucide-react';

export default function NearMePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <MapPin className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Near Me</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Discover nearby businesses and services after live location and verified business discovery are connected.
        </p>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="text-sm font-black text-amber-950">Location discovery is not enabled</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              The live map, device-location permission flow, and verified nearby-business search are not connected. Location actions are disabled so this page does not imply that your location was read or that any business was found.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          To activate this section, connect a real mapping/location provider, request permission explicitly, and verify business listings and distance results end to end.
        </p>
      </section>
    </main>
  );
}
