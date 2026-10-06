import React from 'react';
import { AlertTriangle, Database, KeyRound, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';

const sections = [
  { title: 'Payment & Settlement', icon: Database, items: [
    ['Payment gateways', 'Gateway credentials and webhook configuration are managed server-side.'],
    ['Settlement rules', 'Merchant, seller, fee, refund and dispute rules will be connected to the finance API.'],
    ['Transaction controls', 'Ledger writes, idempotency and approval controls remain API-enforced.'],
  ]},
  { title: 'Security & Access', icon: ShieldCheck, items: [
    ['RBAC', 'Roles and permissions are managed from the Control Tower and enforced by protected routes/API.'],
    ['Step-up authentication', 'Sensitive actions should require the configured authentication policy before execution.'],
    ['Audit trail', 'Administrative changes should produce server-side audit events once the API layer is connected.'],
  ]},
  { title: 'Platform Configuration', icon: SlidersHorizontal, items: [
    ['Experience availability', 'Use Platform Operations to monitor which UniquePlatform experiences are available.'],
    ['Verification policy', 'Verification workflows are managed through the Verification Center.'],
    ['System defaults', 'Global defaults will be exposed here after the server configuration API is completed.'],
  ]},
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-bold">Governance</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Central configuration map for UniquePlatform. Sensitive configuration is intentionally not stored or simulated in the client dashboard.</p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900">Dashboard phase protection</p>
          <p className="text-xs leading-5 text-amber-800 mt-1">No fake fee, gateway key, or “saved” configuration is presented here. Editable system settings will be connected to authenticated server APIs during the API phase.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map(({ title, icon: Icon, items }) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
              <h2 className="font-bold text-slate-900">{title}</h2>
            </div>
            <div className="mt-5 space-y-3">
              {items.map(([name, description]) => (
                <div key={name} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-800">{name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-slate-700 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-bold text-slate-900">Configuration boundary</h2>
            <p className="text-sm text-slate-500 mt-1">The dashboard can describe and surface configuration, but secrets and financial controls must not be implemented as client-only settings.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Secrets</p><p className="mt-1 text-sm font-bold text-slate-700">Server-managed</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Financial rules</p><p className="mt-1 text-sm font-bold text-slate-700">API-enforced</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Audit events</p><p className="mt-1 text-sm font-bold text-slate-700">Server-side</p></div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button disabled className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"><Save className="h-4 w-4" /> Save settings — API phase</button>
        </div>
      </section>
    </div>
  );
}