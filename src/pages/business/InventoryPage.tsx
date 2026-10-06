import React, { useEffect, useState } from 'react';
import { Package, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { requestBusinessStepUp } from '../../components/auth/BusinessAccessGuard';

type Product = { id:string; sellerId:string; name?:string; quantity?:number; status?:string; category?:string; currency?:string; price?:number; images?:string[] };

export default function InventoryPage() {
  const { currentUser } = useAuth();
  const [products,setProducts]=useState<Product[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  const load=async()=>{ if(!currentUser)return; setLoading(true);setError(''); try {
    const snap=await getDocs(query(collection(db,'products'),where('sellerId','==',currentUser.uid)));
    setProducts(snap.docs.map(d=>({id:d.id,...d.data()} as Product)));
  } catch(e){console.error(e);setError('We could not load your inventory. Please try again.');} finally{setLoading(false);} };
  useEffect(()=>{void load();},[currentUser?.uid]);

  const adjust=async(product:Product,direction:'in'|'out')=>{
    const raw=window.prompt(direction==='in'?'Quantity to add':'Quantity to remove','1');
    if(raw===null)return; const quantity=Number(raw);
    if(!Number.isInteger(quantity)||quantity<1){setError('Enter a positive whole quantity.');return;}
    if(direction==='out' && quantity>Number(product.quantity||0)){setError('Stock out cannot exceed available inventory.');return;}
    if(!currentUser){setError('Please sign in again.');return;}
    const businessId=localStorage.getItem('unique_business_id')||'';
    if(!businessId){setError('Business workspace context is missing. Please unlock Business Platform again.');return;}
    const stepUpPassword=window.prompt('Sensitive inventory action. Re-enter your Business password to continue.');
    if(stepUpPassword===null)return;
    setBusy(product.id+direction);setError('');
    try{
      await requestBusinessStepUp(currentUser,businessId,stepUpPassword);
      const token=await currentUser.getIdToken();
      const businessSession=localStorage.getItem('unique_business_session')||'';
      const response=await fetch('/api/business/inventory/adjust',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Business-Session':businessSession},body:JSON.stringify({productId:product.id,direction,quantity})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.message||data?.error?.message||'Inventory adjustment failed.');
      await load();
    }catch(e){console.error(e);setError(e instanceof Error?e.message:'Inventory adjustment failed.');}finally{setBusy('');}
  };

  return <div className="space-y-6 max-w-7xl mx-auto pb-12">
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1><p className="text-sm text-slate-500 mt-1">Track stock levels and stock movements.</p></div><button onClick={()=>void load()} disabled={loading} className="border border-slate-200 bg-white px-4 py-2 rounded-xl text-sm flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>
    {error&&<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {loading?<div className="bg-white border border-slate-200 rounded-3xl p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400"/></div>:products.length===0?<div className="bg-white border border-slate-200 rounded-3xl p-12 text-center"><Package className="w-12 h-12 text-slate-400 mx-auto mb-4"/><h3 className="text-lg font-semibold text-slate-900">No inventory records</h3><p className="text-slate-500 mt-1">Add real products to your catalog first.</p></div>:<div className="bg-white border border-slate-200 rounded-3xl overflow-hidden divide-y divide-slate-100">{products.map(p=><div key={p.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4"><div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">{p.images?.[0]?<img src={p.images[0]} alt="" className="w-full h-full object-cover"/>:<Package className="w-7 h-7 m-3 text-slate-400"/>}</div><div className="flex-1 min-w-0"><h3 className="font-semibold text-slate-900 truncate">{p.name||'Unnamed product'}</h3><p className="text-sm text-slate-500 capitalize">{p.category||'Uncategorized'} · {p.status||'unknown'}</p></div><div className="text-sm font-semibold text-slate-900">Stock: {Number(p.quantity||0)}</div><div className="flex gap-2"><button onClick={()=>void adjust(p,'out')} disabled={!!busy} className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 disabled:opacity-50"><ArrowUpRight className="w-4 h-4"/>Out</button><button onClick={()=>void adjust(p,'in')} disabled={!!busy} className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 disabled:opacity-50"><ArrowDownRight className="w-4 h-4"/>In</button></div></div>)}</div>}
  </div>;
}
