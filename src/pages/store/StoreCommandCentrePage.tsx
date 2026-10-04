import React,{useMemo,useState} from "react";
import{BarChart3,Bot,Building2,FileText,Globe2,Headphones,LockKeyhole,MapPin,Megaphone,Package,RefreshCw,ShieldCheck,Sparkles,Truck,Users,X,ChevronRight}from"lucide-react";
const modules=[
["subscriptions","Subscriptions & recurring commerce","Recurring orders, reminders, skip/edit/cancel and stock-price recheck.","Commerce",RefreshCw],
["gifts","Gifts & group buying","Gifts, shared lists, contributions and coordinated orders.","Commerce",Users],
["local","Local marketplace","Nearby products, services, businesses, events, jobs and pickup.","Commerce",MapPin],
["procurement","Procurement & RFQ","Requests, supplier quotes, comparison, negotiation, approvals and POs.","Commerce",Building2],
["documents","Invoices, receipts & documents","Order-linked receipts, invoices, quotations and business records.","Operations",FileText],
["inventory","Inventory & fulfillment","Available/reserved stock, branches, low-stock signals and fulfillment routing.","Operations",Package],
["delivery","Logistics & tracking","Delivery offers, scheduling, pickup, tracking, OTP and proof of delivery.","Operations",Truck],
["support","Support & disputes","Order-linked help, evidence, returns, refunds and escalation.","Operations",Headphones],
["marketing","Seller growth & campaigns","Promotions, sponsored listings, budgets, analytics and anti-abuse.","Operations",Megaphone],
["analytics","Commerce intelligence","Customer, seller, product and marketplace analytics with privacy boundaries.","Intelligence",BarChart3],
["ai","AI commerce agent","Search, compare, price-watch, reorder and explain real Store data; never silently pays.","Intelligence",Bot],
["trust","Trust & fair ranking","Verification, reputation, review integrity, fraud signals and transparent ranking.","Intelligence",ShieldCheck],
["privacy","Privacy & consent","Location, personalization, AI, notification, data and session controls.","Intelligence",LockKeyhole],
["global","Global commerce","Country, currency, language, shipping, returns and market-rule configuration.","Platform",Globe2],
["partners","Partner/API platform","Scoped catalog, inventory, order, delivery and booking integrations.","Platform",Sparkles],
["reliability","Reliability & recovery","Idempotency, reconciliation, backups, monitoring, retries and graceful degradation.","Platform",RefreshCw]
] as const;
const bullets:Record<string,string[]>={
subscriptions:["Weekly, fortnightly, monthly or custom schedules","Pre-renewal stock, price and delivery check","Skip, edit or cancel before authorization"],
gifts:["Gift recipient and message","Shared lists and group contributions","Permissioned approvals and coordinated delivery"],
local:["Nearby products and services","Open/available and delivery filters","Verified-location signals and opt-in alerts"],
procurement:["RFQ with specification and deadline","Supplier quote comparison","Counter-offers, approvals and purchase orders"],
documents:["Server-derived order totals","Customer receipts and seller invoices","Quotation and pro-forma support"],
inventory:["Available versus reserved stock","Multiple branches or warehouses","Oversell protection and reconciliation"],
delivery:["Platform, seller and pickup options","Scheduled delivery and tracking states","Delivery OTP and proof of delivery"],
support:["Order-linked cases","Photo/video/document evidence","Seller response and platform escalation"],
marketing:["Discounts, bundles and delivery offers","Clearly labelled sponsored placement","Campaign performance and anti-abuse"],
analytics:["Views, saves, carts, orders and returns","Seller and marketplace performance","Aggregated regional demand and forecasts"],
ai:["Natural-language product search","Compare actual listings","Prepare checkout; user authorizes every payment"],
trust:["Verified seller/business signals","Review and transaction integrity","Fair ranking and fraud review"],
privacy:["Permission controls","Location and personalization choices","AI/data and security controls"],
global:["Country and currency model","Localized delivery and returns","Market-specific compliance configuration"],
partners:["Scoped APIs and webhooks","Catalog/inventory synchronization","Sandbox, audit and credential rotation"],
reliability:["Idempotent order/payment operations","Retry and reconciliation states","Backups, restore tests and graceful degradation"]
};
export default function StoreCommandCentrePage(){
const[q,setQ]=useState("");const[active,setActive]=useState<string|null>(null);
const visible=useMemo(()=>modules.filter(m=>(m[1]+" "+m[2]).toLowerCase().includes(q.toLowerCase())),[q]);
const groups=["Commerce","Operations","Intelligence","Platform"];
return <div className="min-h-full bg-slate-50 p-4 pb-10 sm:p-6">
<section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7"><div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl"/><div className="relative"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black tracking-[.18em] text-emerald-200"><Sparkles className="h-3.5 w-3.5"/>UNIQUE STORE OS</span><h1 className="mt-3 text-2xl font-black sm:text-4xl">Commerce Command Centre</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">Bulk-built foundation for the complete Store roadmap: buyer commerce, seller operations, logistics, trust, AI, procurement, privacy and global expansion.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200">{modules.length} modules mapped</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/75">Nigeria-first</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/75">No silent payments</span></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find a Store capability..." className="mt-5 w-full max-w-xl rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-emerald-300"/></div></section>
<div className="mt-6 space-y-7">{groups.map(g=>{const list=visible.filter(m=>m[3]===g);if(!list.length)return null;return <section key={g}><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700">{g}</p><h2 className="text-lg font-black text-slate-900">{g==="Commerce"?"Customer & marketplace experiences":g==="Operations"?"Seller, order & service operations":g==="Intelligence"?"Smart, safe and explainable commerce":"Scalable platform foundation"}</h2></div><span className="text-xs font-bold text-slate-400">{list.length}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(m=>{const I=m[4];return <button key={m[0]} onClick={()=>setActive(m[0])} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><I className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h3 className="text-sm font-black text-slate-900">{m[1]}</h3><ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600"/></div><p className="mt-1 text-xs leading-5 text-slate-500">{m[2]}</p><span className="mt-3 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">Foundation</span></div></div></button>})}</div></section>})}</div>
{active&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 sm:items-center"><div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl"><div className="flex justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700">Store module</p><h2 className="mt-1 text-xl font-black text-slate-900">{modules.find(m=>m[0]===active)?.[1]}</h2><p className="mt-1 text-sm text-slate-500">{modules.find(m=>m[0]===active)?.[2]}</p></div><button onClick={()=>setActive(null)} className="rounded-full bg-slate-100 p-2"><X className="h-4 w-4"/></button></div><div className="mt-5 space-y-2">{bullets[active]?.map(b=><div key={b} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">✓ {b}</div>)}</div><div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Foundation only: real payments, verification, logistics, external integrations and regulatory actions must be backed by production services before being presented as completed.</div></div></div>}
</div>}
