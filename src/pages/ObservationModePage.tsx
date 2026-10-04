import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BriefcaseBusiness, CreditCard, MessageCircle,
  ShoppingBag, Video, Image, Bell, Settings, Store, WalletCards
} from 'lucide-react';

const destinations = [
  { to: '/os/pay', label: 'UniquePay', text: 'Observe wallet, transfers, KYC and payment tools.', icon: CreditCard },
  { to: '/os/messages', label: 'Communication', text: 'Observe messaging and conversation screens.', icon: MessageCircle },
  { to: '/store', label: 'Unique Store', text: 'Observe the buyer marketplace and commerce journey.', icon: ShoppingBag },
  { to: '/conference', label: 'Online Conference', text: 'Observe the conference experience.', icon: Video },
  { to: '/media', label: 'UniqueMedia', text: 'Observe the media library and player experience.', icon: Image },
  { to: '/os/notifications', label: 'Notifications', text: 'Observe the connected notification centre.', icon: Bell },
  { to: '/os/business/dashboard', label: 'Business / Seller', text: 'Observe seller operations and dashboard tools.', icon: BriefcaseBusiness },
  { to: '/store/command-centre', label: 'Store Command Centre', text: 'Observe the full commerce ecosystem roadmap UI.', icon: Store },
  { to: '/os/pay/security', label: 'Pay Security', text: 'Observe security controls without changing them.', icon: WalletCards },
  { to: '/os/settings', label: 'Settings', text: 'Observe the broader UniqueOS settings experience.', icon: Settings },
];

export default function ObservationModePage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-emerald-400/20 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Unique One</p>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">Test & Observation Mode</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Navigation is open so you can inspect the product without repeatedly entering authorization details.
                Real-money and protected backend operations remain secured.
              </p>
            </div>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200">
              TEST ONLY
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {destinations.map(({ to, label, text, icon: Icon }) => (
              <Link key={to} to={to} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/40 hover:bg-emerald-300/10">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{label}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-emerald-300" />
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100/80">
            Observation mode does not disable server authentication, transaction PIN checks, wallet authorization, Firestore rules, or real payment execution.
          </div>
        </div>
      </div>
    </div>
  );
}
