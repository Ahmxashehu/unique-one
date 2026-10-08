import React, { useEffect, useState } from 'react';
import { Users, Plus, Loader2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type StaffInvite = { id: string; businessId?: string; inviteeEmail: string; role: string; branchId?: string; branchName?: string; status: string };
type BusinessBranch = { id: string; name: string; status?: string; businessId?: string };

export default function StaffPage() {
  const { currentUser } = useAuth();
  const [invites,setInvites]=useState<StaffInvite[]>([]), [branches,setBranches]=useState<BusinessBranch[]>([]);
  const [loading,setLoading]=useState(true), [saving,setSaving]=useState(false), [showForm,setShowForm]=useState(false);
  const [email,setEmail]=useState(''), [role,setRole]=useState('manager'), [branchId,setBranchId]=useState('');
  const [error,setError]=useState(''), [success,setSuccess]=useState('');
  const request = async (path:string, options:RequestInit={}) => {
    if (!currentUser) throw new Error('Authentication required.');
    const token=await currentUser.getIdToken(), session=localStorage.getItem('unique_business_session')||'';
    const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Business-Session':session,...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error?.message||'Business request failed.');
    return data;
  };
  const load=async()=>{ if(!currentUser)return; setLoading(true);setError('');try{const data=await request('/api/business/staff');setInvites(Array.isArray(data.invites)?data.invites:[]);setBranches((Array.isArray(data.branches)?data.branches:[]).filter((b:any)=>b.status!=='inactive'));}catch(e){setError(e instanceof Error?e.message:'We could not load staff data.')}finally{setLoading(false)}};
  useEffect(()=>{void load()},[currentUser?.uid]);
  const invite=async(e:React.FormEvent)=>{e.preventDefault();if(!email.trim())return;setSaving(true);setError('');setSuccess('');try{await request('/api/business/staff/invite',{method:'POST',body:JSON.stringify({inviteeEmail:email.trim().toLowerCase(),role,branchId:branchId||null})});setEmail('');setBranchId('');setRole('manager');setShowForm(false);setSuccess('Staff invitation created successfully.');await load()}catch(err){setError(err instanceof Error?err.message:'We could not create the invitation.')}finally{setSaving(false)}};
  return <div className="space-y-6 max-w-7xl mx-auto pb-12">
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff & Teams</h1><p className="text-sm text-slate-500 mt-1">Invite team members and assign business roles.</p></div><button onClick={()=>setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4"/> Invite Staff</button></div>
    {error&&<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}{success&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}
    {showForm&&<form onSubmit={invite} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Invite a staff member</h2><button type="button" onClick={()=>setShowForm(false)}><X className="w-5 h-5 text-slate-500"/></button></div><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Staff email address" className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none"/><div className="grid sm:grid-cols-2 gap-4"><select value={role} onChange={e=>setRole(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-3 bg-white">{['admin','manager','sales','cashier','accountant','inventory','support','delivery','branch_manager','viewer'].map(x=><option key={x} value={x}>{x.replace('_',' ')}</option>)}</select><select value={branchId} onChange={e=>setBranchId(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-3 bg-white"><option value="">All business / no branch restriction</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><button disabled={saving} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-medium disabled:opacity-50">{saving?'Creating invitation…':'Create Invitation'}</button></form>}
    {loading?<div className="bg-white border border-slate-200 rounded-3xl p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400"/></div>:invites.length===0?<div className="bg-white border border-slate-200 rounded-3xl p-12 text-center"><Users className="w-12 h-12 text-slate-400 mx-auto mb-4"/><h3 className="text-lg font-semibold text-slate-900">No staff invitations yet</h3></div>:<div className="bg-white border border-slate-200 rounded-3xl overflow-hidden"><div className="flex justify-end p-3 border-b border-slate-100"><button onClick={()=>void load()} className="text-sm text-slate-600 flex items-center gap-1"><RefreshCw className="w-4 h-4"/> Refresh</button></div><div className="divide-y divide-slate-100">{invites.map(i=><div key={i.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-semibold text-slate-900">{i.inviteeEmail}</p><p className="text-sm text-slate-500 mt-1">{i.role.replace('_',' ')}{i.branchName?' · '+i.branchName:''}</p></div><span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold uppercase">{i.status}</span></div>)}</div></div>}
  </div>;
}
