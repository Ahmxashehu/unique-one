import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { DASHBOARD_ACCESS_ROLES } from '../../lib/auth/rbac';
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
  access: readonly string[];
  sensitive: 'Standard' | 'Restricted' | 'High';
  icon: React.ElementType;
};

const dashboards: DashboardItem[] = [
  { id:'personal', name:'Personal Dashboard', role:'Everyone', purpose:'Personal activity, orders, bookings, messages, notifications and connected Unique One experiences.', route:'/os/dashboard', access:DASHBOARD_ACCESS_ROLES.personal, sensitive:'Standard', icon:LayoutDashboard },
  { id:'pay', name:'UniquePay Dashboard', role:'Pay customer + Pay Operations', purpose:'Wallet, transfers, bills, transaction activity, settlements and payment operations.', route:'/os/pay', access:DASHBOARD_ACCESS_ROLES.uniquepay, sensitive:'High', icon:Wallet },
  { id:'store', name:'Store Seller Dashboard', role:'Seller + Store team', purpose:'Listings, inventory, orders, customers, bookings, payouts and marketplace operations.', route:'/os/workspace/store', access:DASHBOARD_ACCESS_ROLES.store_seller, sensitive:'Restricted', icon:Store },
  { id:'business', name:'Business Dashboard', role:'Business owner / manager', purpose:'Business profile, products, services, staff, customers, payments, marketing and analytics.', route:'/os/workspace/business', access:DASHBOARD_ACCESS_ROLES.business, sensitive:'Restricted', icon:Building2 },
  { id:'institution', name:'Institution Dashboard', role:'Institution administrator', purpose:'Organization members, departments, services, communication, finance and reports.', route:'/os/workspace/institution', access:DASHBOARD_ACCESS_ROLES.institution, sensitive:'Restricted', icon:Landmark },
  { id:'operations', name:'Operations Dashboard', role:'Service providers + operational staff', purpose:'Requests, schedules, active jobs, fulfilment, customers, payments and reviews.', route:'/os/workspace/operations', access:DASHBOARD_ACCESS_ROLES.operations, sensitive:'Restricted', icon:BriefcaseBusiness },
  { id:'edge', name:'Active Edge Dashboard', role:'Creators, businesses, organizations', purpose:'Posts, status, followers, engagement, campaigns, events and content management.', route:'/os/workspace/active-edge', access:DASHBOARD_ACCESS_ROLES.active_edge, sensitive:'Standard', icon:Radio },
  { id:'ai', name:'Unique AI Dashboard', role:'Users + authorized operators', purpose:'AI assistants, generated content, documents, images, automations and usage controls.', route:'/os/workspace/ai', access:DASHBOARD_ACCESS_ROLES.unique_ai, sensitive:'Standard', icon:Bot },
  { id:'finance', name:'Finance & Settlement Dashboard', role:'Finance officers', purpose:'Reconciliation, merchant and seller settlement, commissions, fees, refunds and disputes.', route:'/admin/workspace/finance', access:DASHBOARD_ACCESS_ROLES.finance_settlement, sensitive:'High', icon:Landmark },
  { id:'risk', name:'Security & Risk Dashboard', role:'Risk, security and compliance', purpose:'Fraud signals, identity reviews, access events, cases, audit trails and compliance.', route:'/admin/workspace/risk', access:DASHBOARD_ACCESS_ROLES.security_risk, sensitive:'High', icon:ShieldCheck },
  { id:'admin', name:'Platform Admin Dashboard', role:'Platform administrators', purpose:'Users, businesses, marketplace, services, content, reports, configuration and platform operations.', route:'/admin/workspace/platform', access:DASHBOARD_ACCESS_ROLES.platform_admin, sensitive:'High', icon:Settings2 },
  { id:'super', name:'Super Admin Control Tower', role:'Authorized super administrators', purpose:'Global platform oversight, executive indicators, critical alerts, governance and controlled configuration.', route:'/admin/workspace/super', access:DASHBOARD_ACCESS_ROLES.super_admin, sensitive:'High', icon:Activity },
];

const accessColors: Record<DashboardItem['sensitive'], string> = {
  Standard:'bg-slate-100 text-slate-600',
  Restricted:'bg-amber-50 text-amber-700',
  High:'bg-rose-50 text-rose-700',
};

export default function AdminControlTowerPage() {
  const [query, setQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All roles');
  const [filter, setFilter] = useState<'All'|'Standard'|'Restricted'|'High'>('All');
  const { currentUser, hasPermission } = useAuth();
  const [rbacUsers, setRbacUsers] = useState<Array<{uid:string;displayName:string;email:string;phone:string;roles:string[];permissions:string[];status:string}>>([]);
  const [rbacRoles, setRbacRoles] = useState<Array<{role:string;permissions:string[]}>>([]);
  const [rbacPermissions, setRbacPermissions] = useState<string[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [rbacMessage, setRbacMessage] = useState('');
  const [rbacBusy, setRbacBusy] = useState(false);
  useEffect(() => {
    if (!currentUser || !hasPermission('manage:roles')) return;
    void (async () => {
      try {
        const token = await currentUser.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [catalogRes, usersRes] = await Promise.all([
          fetch('/api/admin/rbac/catalog', { headers }),
          fetch('/api/admin/rbac/users?limit=100', { headers }),
        ]);
        if (!catalogRes.ok || !usersRes.ok) throw new Error('Permission centre could not be loaded.');
        const catalog = await catalogRes.json();
        const users = await usersRes.json();
        setRbacRoles(Array.isArray(catalog.roles) ? catalog.roles : []);
        setRbacPermissions(Array.isArray(catalog.permissions) ? catalog.permissions : []);
        setRbacUsers(Array.isArray(users.users) ? users.users : []);
      } catch (error) {
        setRbacMessage(error instanceof Error ? error.message : 'Permission centre could not be loaded.');
      }
    })();
  }, [currentUser]);

  useEffect(() => {
    const selected = rbacUsers.find(user => user.uid === selectedUid);
    setDraftRoles(selected?.roles ?? []);
    setDraftPermissions(selected?.permissions ?? []);
  }, [selectedUid, rbacUsers]);

  const saveRbac = async () => {
    if (!currentUser || !selectedUid) return;
    setRbacBusy(true);
    setRbacMessage('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/rbac/users/${encodeURIComponent(selectedUid)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: draftRoles, permissions: draftPermissions }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Role update failed.');
      setRbacUsers(users => users.map(user => user.uid === selectedUid ? { ...user, roles: payload.roles ?? draftRoles, permissions: payload.permissions ?? draftPermissions } : user));
      setRbacMessage('Access profile updated and audit event recorded.');
    } catch (error) {
      setRbacMessage(error instanceof Error ? error.message : 'Role update failed.');
    } finally {
      setRbacBusy(false);
    }
  };

  const roles = useMemo(() => ['All roles', ...Array.from(new Set(dashboards.flatMap(d => d.access)))], []);
  const visible = useMemo(() => dashboards.filter(d => {
    const q = query.trim().toLowerCase();
    const matchesText = !q || [d.name,d.role,d.purpose,...d.access].join(' ').toLowerCase().includes(q);
    const matchesFilter = filter === 'All' || d.sensitive === filter;
    const matchesRole = selectedRole === 'All roles' || d.access.includes(selectedRole);
    return matchesText && matchesFilter && matchesRole;
  }), [query, filter, selectedRole]);

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-emerald-200">
            <LockKeyhole className="h-3.5 w-3.5" /> Governance
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-4xl">UniquePlatform Control Tower</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
            One role-based management architecture for Personal, Pay, Store, Business, Operations, Finance, Security and Platform administration.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl">
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">{dashboards.length}</p><p className="text-[10px] text-white/60">Dashboard environments</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">RBAC</p><p className="text-[10px] text-white/60">Permission centre</p></div>
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
          <select value={selectedRole} onChange={e=>setSelectedRole(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 outline-none">
            {roles.map(role=><option key={role}>{role}</option>)}
          </select>
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

      {hasPermission('manage:roles') && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Role & Permission Centre</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Manage a user's role assignments and custom permissions. Restricted platform roles require Super Admin authority.</p>
            </div>
            <button onClick={saveRbac} disabled={!selectedUid || rbacBusy} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{rbacBusy ? 'Saving…' : 'Save access profile'}</button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
            <select value={selectedUid} onChange={e=>setSelectedUid(e.target.value)} className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700">
              <option value="">Select a user…</option>
              {rbacUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName || user.phone || user.email || user.uid}</option>)}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Roles</p>
                <div className="grid gap-2">
                  {rbacRoles.map(item => <label key={item.role} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={draftRoles.includes(item.role)} onChange={e=>setDraftRoles(value=>e.target.checked ? [...value,item.role] : value.filter(role=>role!==item.role))} />
                    {item.role}
                  </label>)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Custom permissions</p>
                <div className="grid gap-2">
                  {rbacPermissions.map(permission => <label key={permission} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={draftPermissions.includes(permission)} onChange={e=>setDraftPermissions(value=>e.target.checked ? [...value,permission] : value.filter(item=>item!==permission))} />
                    {permission}
                  </label>)}
                </div>
              </div>
            </div>
          </div>
          {rbacMessage && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{rbacMessage}</p>}
        </section>
      )}

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/>
          <div>
            <h2 className="text-sm font-black text-slate-900">Role & Permission Centre — foundation</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Role grants dashboard access; permissions grant individual actions. Use this map as the foundation for granular View, Create, Edit, Approve, Execute and Administer permissions. Sensitive actions should use step-up authentication and create an audit event. This page is the management map and does not grant new privileges by itself.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
