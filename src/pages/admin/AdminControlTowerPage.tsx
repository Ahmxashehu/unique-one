import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, Store, Building2, Users, BriefcaseBusiness,
  Radio, Bot, Landmark, ShieldCheck, Settings2, Search, ChevronRight,
  LockKeyhole, Activity, ClipboardCheck
} from 'lucide-react';

type DashboardItem = {
  id: string;
  name: string;
  role: string;
  purpose: string;
  route: string;
  access: string[];
  sensitive: 'Standard' | 'Restricted' | 'High';
  icon: React.ElementType;
};

const dashboards: DashboardItem[] = [
  { id:'personal', name:'Personal Dashboard', role:'Everyone', purpose:'Personal activity, orders, bookings, messages, notifications and connected Unique One experiences.', route:'/os/dashboard', access:['customer','buyer'], sensitive:'Standard', icon:LayoutDashboard },
  { id:'pay', name:'UniquePay Dashboard', role:'Pay customer + Pay Operations', purpose:'Wallet, transfers, bills, transaction activity, settlements and payment operations.', route:'/os/pay', access:['customer','finance'], sensitive:'High', icon:Wallet },
  { id:'store', name:'Store Seller Dashboard', role:'Seller + Store team', purpose:'Listings, inventory, orders, customers, bookings, payouts and marketplace operations.', route:'/os/business/dashboard', access:['seller','business_owner'], sensitive:'Restricted', icon:Store },
  { id:'business', name:'Business Dashboard', role:'Business owner / manager', purpose:'Business profile, products, services, staff, customers, payments, marketing and analytics.', route:'/os/business/dashboard', access:['business_owner','staff_member'], sensitive:'Restricted', icon:Building2 },
  { id:'institution', name:'Institution Dashboard', role:'Institution administrator', purpose:'Organization members, departments, services, communication, finance and reports.', route:'/os/business/members', access:['school_administrator'], sensitive:'Restricted', icon:Landmark },
  { id:'operations', name:'Operations Dashboard', role:'Service providers + operational staff', purpose:'Requests, schedules, active jobs, fulfilment, customers, payments and reviews.', route:'/os/services', access:['service_provider','driver','logistics_provider'], sensitive:'Restricted', icon:BriefcaseBusiness },
  { id:'edge', name:'Active Edge Dashboard', role:'Creators, businesses, organizations', purpose:'Posts, status, followers, engagement, campaigns, events and content management.', route:'/os/dashboard', access:['customer','business_owner'], sensitive:'Standard', icon:Radio },
  { id:'ai', name:'Unique AI Dashboard', role:'Users + authorized operators', purpose:'AI assistants, generated content, documents, images, automations and usage controls.', route:'/os/ai', access:['customer','developer','administrator'], sensitive:'Standard', icon:Bot },
  { id:'finance', name:'Finance & Settlement Dashboard', role:'Finance officers', purpose:'Reconciliation, merchant and seller settlement, commissions, fees, refunds and disputes.', route:'/admin/transactions', access:['finance'], sensitive:'High', icon:Landmark },
  { id:'risk', name:'Security & Risk Dashboard', role:'Risk, security and compliance', purpose:'Fraud signals, identity reviews, access events, cases, audit trails and compliance.', route:'/admin/verification', access:['moderator','administrator'], sensitive:'High', icon:ShieldCheck },
  { id:'admin', name:'Platform Admin Dashboard', role:'Platform administrators', purpose:'Users, businesses, marketplace, services, content, reports, configuration and platform operations.', route:'/admin/users', access:['administrator'], sensitive:'High', icon:Settings2 },
  { id:'super', name:'Super Admin Control Tower', role:'Authorized super administrators', purpose:'Global platform oversight, executive indicators, critical alerts, governance and controlled configuration.', route:'/admin/control-tower', access:['administrator'], sensitive:'High', icon:Activity },
];

const accessColors: Record<DashboardItem['sensitive'], string> = {
  Standard:'bg-slate-100 text-slate-600',
  Restricted:'bg-amber-50 text-amber-700',
  High:'bg-rose-50 text-rose-700',
};

export default function AdminControlTowerPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All'|'Standard'|'Restricted'|'High'>('All');
  const visible = useMemo(() => dashboards.filter(d => {
    const q = query.trim().toLowerCase();
    const matchesText = !q || [d.name,d.role,d.purpose,...d.access].join(' ').toLowerCase().includes(q);
    const matchesFilter = filter === 'All' || d.sensitive === filter;
    return matchesText && matchesFilter;
  }), [query, filter]);

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-emerald-200">
            <LockKeyhole className="h-3.5 w-3.5" /> Governance
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-4xl">Unique One Control Tower</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
            One role-based management architecture for Personal, Pay, Store, Business, Operations, Finance, Security and Platform administration.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl">
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">{dashboards.length}</p><p className="text-[10px] text-white/60">Dashboard environments</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">1</p><p className="text-[10px] text-white/60">Permission centre</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">RBAC</p><p className="text-[10px] text-white/60">Access model</p></div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search dashboards, roles or responsibilities…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {(['All','Standard','Restricted','High'] as const).map(item => (
              <button key={item} onClick={()=>setFilter(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black ${filter===item?'bg-slate-950 text-white':'bg-slate-100 text-slate-600'}`}>{item}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(d => {
          const Icon=d.icon;
          return (
            <div key={d.id} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5"/></span>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${accessColors[d.sensitive]}`}>{d.sensitive}</span>
              </div>
              <h2 className="mt-4 text-base font-black text-slate-900">{d.name}</h2>
              <p className="mt-1 text-xs font-bold text-emerald-700">{d.role}</p>
              <p className="mt-3 min-h-[52px] text-sm leading-6 text-slate-500">{d.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.access.map(role => <span key={role} className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{role}</span>)}
              </div>
              <Link to={d.route} className="mt-5 inline-flex items-center gap-1 text-xs font-black text-slate-900 hover:text-emerald-700">
                Open workspace <ChevronRight className="h-4 w-4"/>
              </Link>
            </div>
          );
        })}
      </section>

      {visible.length===0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No dashboard matches your search.</div>}

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/>
          <div>
            <h2 className="text-sm font-black text-slate-900">Architecture rule</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Role grants dashboard access; permissions grant individual actions. Sensitive actions should use step-up authentication and create an audit event. This page is the management map and does not grant new privileges by itself.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
