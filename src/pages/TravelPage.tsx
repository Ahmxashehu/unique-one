import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Hotel, MapPinned, CalendarDays, ShieldCheck, Car, BusFront, UserRound, Map, Ticket, UtensilsCrossed, UsersRound, Bookmark, BriefcaseBusiness, X, ArrowLeft, Navigation, CircleAlert } from 'lucide-react';

type TravelMode = 'flights' | 'car' | 'bus' | 'hire' | 'stays' | 'activities' | 'destinations' | 'plan' | 'trips' | 'saved' | 'group' | 'nearby';
const options: Array<{id:TravelMode;icon:typeof Plane;label:string;description:string}> = [
{id:'flights',icon:Plane,label:'Flights',description:'Domestic and international air travel'},
{id:'car',icon:Car,label:'Travel by car',description:'Road rides and trips'},
{id:'bus',icon:BusFront,label:'Bus & coach',description:'Seats and schedules'},
{id:'hire',icon:UserRound,label:'Car hire',description:'Vehicle and driver'},
{id:'stays',icon:Hotel,label:'Hotels & stays',description:'Rooms and accommodation'},
{id:'activities',icon:Ticket,label:'Activities',description:'Things to do'},
{id:'destinations',icon:Map,label:'Destinations',description:'Discover places'},
{id:'plan',icon:CalendarDays,label:'Plan my trip',description:'Build an itinerary'},
{id:'trips',icon:MapPinned,label:'My trips',description:'Confirmed bookings and itineraries'},
{id:'saved',icon:Bookmark,label:'Saved places',description:'Your favourites'},
{id:'group',icon:UsersRound,label:'Group travel',description:'Travel together'},
{id:'nearby',icon:Navigation,label:'Nearby travel',description:'Providers and services around you'},
];
export default function TravelPage(){
 const navigate=useNavigate(); const [selected,setSelected]=useState<TravelMode|null>(null);
 const selectedOption=options.find(item=>item.id===selected);
 return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Unique Travel">
 <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center py-3 sm:py-8"><section className="w-full overflow-hidden rounded-[28px] border border-white/30 bg-white/95 shadow-[0_25px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
 <header className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-4 py-5 text-white sm:px-6 sm:py-6"><div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl"/><div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-emerald-200"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10"><Plane className="h-4 w-4"/></span><span className="text-xs font-black uppercase tracking-[0.16em]">Unique Travel</span></div><h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Plan • Book • Travel • Track</h1><p className="mt-1 max-w-xl text-sm text-slate-300">Travel services will be enabled as their verified providers and booking integrations pass production checks.</p></div><button type="button" onClick={()=>navigate(-1)} aria-label="Close Unique Travel" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"><X className="h-5 w-5"/></button></div></header>
 <div className="p-3 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3 px-1"><div><p className="text-sm font-black text-slate-900">Travel services</p><p className="text-xs text-slate-500">Select a category to check its current availability.</p></div><span className="hidden rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-800 sm:block">Live integrations pending</span></div>
 <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{options.map(({id,icon:Icon,label,description})=><button key={id} type="button" onClick={()=>setSelected(id)} aria-pressed={selected===id} className={`group min-w-0 rounded-2xl border p-3 text-left shadow-sm transition duration-200 hover:border-emerald-300 hover:shadow-md sm:p-4 ${selected===id?'border-emerald-500 bg-emerald-50':'border-slate-200 bg-white'}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-10 sm:w-10"><Icon className="h-4.5 w-4.5"/></span><span className="mt-2 block text-xs font-black text-slate-900 sm:text-sm">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500 sm:text-xs">{description}</span></button>)}</div>
 {selectedOption&&<section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><div><h2 className="text-sm font-black text-amber-950">{selectedOption.label}: live service unavailable</h2><p className="mt-1 text-xs leading-5 text-amber-900">A real provider connection for this service has not been verified. No search, booking, payment, itinerary, or service request has been submitted.</p>{selected==='flights'&&<Link to="/flights" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">View flight status <ArrowLeft className="h-3.5 w-3.5 rotate-180"/></Link>}</div></div></section>}
 <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><p className="text-xs leading-5 text-slate-600">This page does not display sample prices, invented providers, or simulated booking confirmations. Confirmed trips will appear only when a real booking system is connected.</p></div>
 </div></section></div></div>;
}
