import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DASHBOARD_ACCESS_ROLES, type DashboardId } from '../lib/auth/rbac';
import {
  LayoutDashboard, Wallet, Store, Building2, Landmark, BriefcaseBusiness, Radio, Bot,
  ShieldCheck, Settings2, Activity, ArrowRight, Users, Package, ShoppingBag, CalendarDays,
  MessageSquare, FileText, BarChart3, CreditCard, Search, Bell, CheckCircle2, Sparkles
} from 'lucide-react';

type Module = { label: string; description: string; to: string; icon: React.ElementType };
type WorkspaceConfig = {
  name: string; eyebrow: string; description: string; icon: React.ElementType;
  modules: Module[]; actions: Module[]; metrics: string[];
};

const configs: Record<DashboardId, WorkspaceConfig> = {
  personal: {
    name:'Personal Dashboard', eyebrow:'MY WORKSPACE',
    description:'Your personal command centre for activity, orders, bookings, messages, notifications and connected Unique One experiences.',
    icon:LayoutDashboard,
    metrics:['Activity','Orders','Bookings','Notifications'],
    actions:[
      {label:'View orders',description:'Track purchases and fulfilment.',to:'/os/orders',icon:ShoppingBag},
      {label:'View bookings',description:'Manage reservations and appointments.',to:'/os/bookings',icon:CalendarDays},
      {label:'Open messages',description:'Continue conversations.',to:'/os/messages',icon:MessageSquare},
      {label:'Notifications',description:'See updates and alerts.',to:'/os/notifications',icon:Bell},
    ],
    modules:[
      {label:'UniquePay',description:'Wallet, transfers and payment activity.',to:'/os/pay',icon:Wallet},
      {label:'Unique Store',description:'Browse, save, cart and orders.',to:'/os/store',icon:Store},
      {label:'Active Edge',description:'Updates, people, businesses and services.',to:'/os/dashboard',icon:Radio},
      {label:'Unique AI',description:'Assistants, content and intelligent tools.',to:'/os/ai',icon:Bot},
    ],
  },
  uniquepay: {
    name:'UniquePay Dashboard', eyebrow:'PAYMENT WORKSPACE',
    description:'A dedicated money workspace for wallet activity, transfers, payment requests, bills and financial history.',
    icon:Wallet, metrics:['Wallet','Transfers','Requests','History'],
    actions:[
      {label:'Send money',description:'Pay a Unique ID, phone or supported recipient.',to:'/os/pay/send',icon:CreditCard},
      {label:'Receive money',description:'Receive through your Unique ID or receiving ID.',to:'/os/pay/receive',icon:Wallet},
      {label:'Transaction history',description:'Review wallet transactions.',to:'/os/pay/history',icon:FileText},
      {label:'Payment security',description:'Review payment protection settings.',to:'/os/pay/security',icon:ShieldCheck},
    ],
    modules:[
      {label:'Beneficiaries',description:'Saved payment recipients.',to:'/os/pay/beneficiaries',icon:Users},
      {label:'Payment requests',description:'Create and manage requests.',to:'/os/payment-requests',icon:CreditCard},
      {label:'Invoices',description:'Create and review invoices.',to:'/os/invoices',icon:FileText},
      {label:'Verification',description:'Identity and payment verification.',to:'/os/pay/verification',icon:CheckCircle2},
    ],
  },
  store_seller: {
    name:'Store Seller Dashboard', eyebrow:'MARKETPLACE WORKSPACE',
    description:'Operate your marketplace business: listings, inventory, orders, customers, bookings and seller finance.',
    icon:Store, metrics:['Listings','Inventory','Orders','Payouts'],
    actions:[
      {label:'Manage catalog',description:'Add products and services.',to:'/os/business/catalog',icon:Package},
      {label:'Inventory',description:'Monitor stock and availability.',to:'/os/business/inventory',icon:Package},
      {label:'Orders',description:'Process marketplace orders.',to:'/os/business/orders',icon:ShoppingBag},
      {label:'Seller finance',description:'Review business finance activity.',to:'/os/business/finance',icon:Wallet},
    ],
    modules:[
      {label:'Customers',description:'Customer records and relationships.',to:'/os/business/customers',icon:Users},
      {label:'Suppliers',description:'Manage supply relationships.',to:'/os/business/suppliers',icon:Building2},
      {label:'Bookings',description:'Service and reservation operations.',to:'/os/bookings',icon:CalendarDays},
      {label:'Reports',description:'Business performance reports.',to:'/os/business/reports',icon:BarChart3},
    ],
  },
  business: {
    name:'Business Dashboard', eyebrow:'BUSINESS WORKSPACE',
    description:'Manage the full organization: profile, staff, branches, products, services, customers, finance, orders and reporting.',
    icon:Building2, metrics:['Business','Customers','Finance','Reports'],
    actions:[
      {label:'Business profile',description:'Manage public business information.',to:'/os/business/profile',icon:Building2},
      {label:'Staff',description:'Manage staff and roles.',to:'/os/business/staff',icon:Users},
      {label:'Catalog',description:'Manage products and services.',to:'/os/business/catalog',icon:Package},
      {label:'Reports',description:'Review business performance.',to:'/os/business/reports',icon:BarChart3},
    ],
    modules:[
      {label:'Branches',description:'Locations and branch operations.',to:'/os/business/branches',icon:Building2},
      {label:'Customers',description:'Business customer relationships.',to:'/os/business/customers',icon:Users},
      {label:'Finance',description:'Invoices, payments and finance.',to:'/os/business/finance',icon:Wallet},
      {label:'Activity',description:'Business activity and audit trail.',to:'/os/business/activity',icon:Activity},
    ],
  },
  institution: {
    name:'Institution Dashboard', eyebrow:'ORGANIZATION WORKSPACE',
    description:'Run an institution or organization with controlled membership, departments, services, communication and reporting.',
    icon:Landmark, metrics:['Members','Services','Finance','Reports'],
    actions:[
      {label:'Members',description:'Manage organization membership.',to:'/os/business/members',icon:Users},
      {label:'Services',description:'Review operational services.',to:'/os/services',icon:BriefcaseBusiness},
      {label:'Finance',description:'Review organization finance tools.',to:'/os/business/finance',icon:Wallet},
      {label:'Reports',description:'Review reports and activity.',to:'/os/business/reports',icon:BarChart3},
    ],
    modules:[
      {label:'Profile',description:'Organization profile and settings.',to:'/os/business/profile',icon:Landmark},
      {label:'Staff',description:'People and operational roles.',to:'/os/business/staff',icon:Users},
      {label:'Communication',description:'Messages and updates.',to:'/os/messages',icon:MessageSquare},
      {label:'Activity',description:'Organization activity.',to:'/os/business/activity',icon:Activity},
    ],
  },
  operations: {
    name:'Operations Dashboard', eyebrow:'SERVICE OPERATIONS',
    description:'Manage active requests, schedules, jobs, fulfilment, customers, services and operational reviews.',
    icon:BriefcaseBusiness, metrics:['Requests','Jobs','Customers','Services'],
    actions:[
      {label:'Service centre',description:'Manage live services and offerings.',to:'/os/services',icon:BriefcaseBusiness},
      {label:'Bookings',description:'Review schedules and appointments.',to:'/os/bookings',icon:CalendarDays},
      {label:'Orders',description:'Handle fulfilment and orders.',to:'/os/orders',icon:ShoppingBag},
      {label:'Customers',description:'View customer operations.',to:'/os/customers',icon:Users},
    ],
    modules:[
      {label:'Catalog',description:'Products and services available for fulfilment.',to:'/os/business/catalog',icon:Package},
      {label:'Payment requests',description:'Collect operational payments.',to:'/os/payment-requests',icon:CreditCard},
      {label:'Invoices',description:'Manage operational invoices.',to:'/os/invoices',icon:FileText},
      {label:'Activity',description:'Track operational events.',to:'/os/business/activity',icon:Activity},
    ],
  },
  active_edge: {
    name:'Active Edge Dashboard', eyebrow:'AUDIENCE & CONTENT WORKSPACE',
    description:'Manage posts, status, audience, engagement, campaigns and events without leaving the Unique One ecosystem.',
    icon:Radio, metrics:['Posts','Audience','Engagement','Campaigns'],
    actions:[
      {label:'Open Active Edge',description:'View the live audience experience.',to:'/os/dashboard',icon:Radio},
      {label:'Create a post',description:'Publish an update or offer.',to:'/os/dashboard',icon:FileText},
      {label:'Messages',description:'Respond to conversations.',to:'/os/messages',icon:MessageSquare},
      {label:'Analytics',description:'Review available performance reports.',to:'/os/business/reports',icon:BarChart3},
    ],
    modules:[
      {label:'Business profile',description:'Keep your public identity current.',to:'/os/business/profile',icon:Building2},
      {label:'Catalog',description:'Promote products and services.',to:'/os/business/catalog',icon:Package},
      {label:'Bookings',description:'Connect audience to appointments.',to:'/os/bookings',icon:CalendarDays},
      {label:'Notifications',description:'Monitor important engagement alerts.',to:'/os/notifications',icon:Bell},
    ],
  },
  unique_ai: {
    name:'Unique AI Dashboard', eyebrow:'INTELLIGENCE WORKSPACE',
    description:'Your AI workspace for assistants, generated content, documents, images, automation and usage controls.',
    icon:Bot, metrics:['Assistants','Content','Documents','Usage'],
    actions:[
      {label:'Open Unique AI',description:'Use the AI experience.',to:'/os/ai',icon:Bot},
      {label:'AI premium',description:'Review available AI plans and capabilities.',to:'/os/ai/premium',icon:CreditCard},
      {label:'Master Vision',description:'Use the platform vision tools.',to:'/os/master-vision',icon:Search},
      {label:'Unique Media',description:'Work with offline media tools.',to:'/unique-media',icon:FileText},
    ],
    modules:[
      {label:'Global Search',description:'Search across the ecosystem.',to:'/search',icon:Search},
      {label:'Documents',description:'Create and manage AI-assisted documents.',to:'/os/ai',icon:FileText},
      {label:'Images',description:'Use intelligent image capabilities.',to:'/os/ai',icon:SparklesIcon},
      {label:'Automations',description:'Prepare repeatable intelligent workflows.',to:'/os/ai',icon:Activity},
    ],
  },
  finance_settlement: {
    name:'Finance & Settlement Dashboard', eyebrow:'FINANCE CONTROL',
    description:'Reconcile financial activity, settlements, commissions, fees, refunds and disputes with controlled access.',
    icon:Landmark, metrics:['Ledger','Settlements','Fees','Disputes'],
    actions:[
      {label:'Global ledger',description:'Review recorded financial transactions.',to:'/admin/transactions',icon:FileText},
      {label:'Reports',description:'Review platform reports.',to:'/admin/reports',icon:BarChart3},
      {label:'Requests',description:'Review operational requests.',to:'/admin/requests',icon:CheckCircle2},
      {label:'Control Tower',description:'Return to platform oversight.',to:'/admin/control-tower',icon:Activity},
    ],
    modules:[
      {label:'UniquePay',description:'Customer payment experience.',to:'/os/pay',icon:Wallet},
      {label:'Seller finance',description:'Business finance and settlements.',to:'/os/business/finance',icon:CreditCard},
      {label:'Audit',description:'Controlled audit information.',to:'/admin/control-tower',icon:ShieldCheck},
      {label:'Reports',description:'Platform-level reporting.',to:'/admin/reports',icon:BarChart3},
    ],
  },
  security_risk: {
    name:'Security & Risk Dashboard', eyebrow:'SECURITY CONTROL',
    description:'Review identity, verification, fraud signals, access events, cases, audit trails and compliance controls.',
    icon:ShieldCheck, metrics:['Verification','Risk','Cases','Audit'],
    actions:[
      {label:'Verification center',description:'Review user verification states.',to:'/admin/verification',icon:CheckCircle2},
      {label:'Users',description:'Review platform account records.',to:'/admin/users',icon:Users},
      {label:'Reports',description:'Review platform reports.',to:'/admin/reports',icon:BarChart3},
      {label:'Control Tower',description:'Return to platform oversight.',to:'/admin/control-tower',icon:Activity},
    ],
    modules:[
      {label:'Transactions',description:'Inspect financial activity where authorized.',to:'/admin/transactions',icon:Wallet},
      {label:'Admin settings',description:'Review controlled platform settings.',to:'/admin/settings',icon:Settings2},
      {label:'Audit',description:'Review governance and access signals.',to:'/admin/control-tower',icon:ShieldCheck},
      {label:'Requests',description:'Review flagged platform requests.',to:'/admin/requests',icon:CheckCircle2},
    ],
  },
  platform_admin: {
    name:'Platform Admin Dashboard', eyebrow:'PLATFORM OPERATIONS',
    description:'Operate users, businesses, marketplace, services, requests, reports and platform configuration.',
    icon:Settings2, metrics:['Users','Businesses','Marketplace','Reports'],
    actions:[
      {label:'Users',description:'Manage platform user records.',to:'/admin/users',icon:Users},
      {label:'Businesses',description:'Manage business records.',to:'/admin/businesses',icon:Building2},
      {label:'Marketplace',description:'Review products and listings.',to:'/admin/products',icon:Store},
      {label:'Requests',description:'Review platform requests.',to:'/admin/requests',icon:CheckCircle2},
    ],
    modules:[
      {label:'Reports',description:'Platform reporting.',to:'/admin/reports',icon:BarChart3},
      {label:'Verification',description:'Identity verification operations.',to:'/admin/verification',icon:ShieldCheck},
      {label:'Transactions',description:'Financial ledger view.',to:'/admin/transactions',icon:Wallet},
      {label:'Settings',description:'Controlled platform configuration.',to:'/admin/settings',icon:Settings2},
    ],
  },
  super_admin: {
    name:'Super Admin Control Tower', eyebrow:'EXECUTIVE CONTROL TOWER',
    description:'Global oversight for Unique One: executive indicators, critical alerts, governance, RBAC and controlled configuration.',
    icon:Activity, metrics:['Platform health','Critical alerts','Governance','RBAC'],
    actions:[
      {label:'Control Tower',description:'Open the full governance centre.',to:'/admin/control-tower',icon:Activity},
      {label:'Platform admin',description:'Operate platform administration.',to:'/admin/users',icon:Settings2},
      {label:'Finance control',description:'Review settlement and ledger operations.',to:'/admin/transactions',icon:Landmark},
      {label:'Security control',description:'Review security and verification.',to:'/admin/verification',icon:ShieldCheck},
    ],
    modules:[
      {label:'RBAC',description:'Roles, permissions and dashboard access.',to:'/admin/control-tower',icon:ShieldCheck},
      {label:'Users',description:'Global user oversight.',to:'/admin/users',icon:Users},
      {label:'Businesses',description:'Global business oversight.',to:'/admin/businesses',icon:Building2},
      {label:'Reports',description:'Executive reporting.',to:'/admin/reports',icon:BarChart3},
    ],
  },
};

function SparklesIcon(props: React.ComponentProps<typeof Sparkles>) {
  return <Sparkles {...props} />;
}

export default function WorkspaceDashboardPage({ dashboard }: { dashboard: DashboardId }) {
  const { userData } = useAuth();
  const config = configs[dashboard];
  const Icon = config.icon;
  const roles = userData?.roles ?? [];
  const roleLabels = roles.length ? roles.map(role => role.replaceAll('_',' ')).join(' • ') : 'Active account';

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-[30px] bg-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.2em] text-emerald-300">{config.eyebrow}</p>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10"><Icon className="h-6 w-6 text-emerald-300" /></span>
              <div><h1 className="text-2xl font-black tracking-tight md:text-3xl">{config.name}</h1><p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">{config.description}</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Current role access</p>
            <p className="mt-1 max-w-xs text-sm font-semibold capitalize text-white">{roleLabels}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {config.metrics.map((metric) => (
          <div key={metric} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{metric}</p>
            <p className="mt-2 text-xl font-black text-slate-900">Available</p>
            <p className="mt-1 text-xs text-slate-500">Workspace module connected</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Quick actions</h2><p className="text-sm text-slate-500">Go directly to the operational screen you need.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Role controlled</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {config.actions.map(item => { const ItemIcon=item.icon; return <Link key={item.label} to={item.to} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ItemIcon className="h-5 w-5"/></span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-600"/></div><h3 className="mt-4 font-bold text-slate-900">{item.label}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p></Link>; })}
        </div>
      </section>

      <section>
        <div className="mb-3"><h2 className="text-lg font-bold text-slate-900">Workspace modules</h2><p className="text-sm text-slate-500">These modules remain separate so each role gets the right operational experience.</p></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {config.modules.map(item => { const ItemIcon=item.icon; return <Link key={item.label} to={item.to} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><ItemIcon className="h-4 w-4"/></span><span><span className="block font-semibold text-slate-900">{item.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></span></Link>; })}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700"/><div><h3 className="font-bold text-slate-900">Dashboard foundation complete</h3><p className="mt-1 text-sm leading-6 text-slate-600">The workspace is separated by role and permission. Existing operational pages remain the working modules; the next stage can connect external APIs and provider services without redesigning the dashboard structure.</p></div></div>
      </section>
    </div>
  );
}
