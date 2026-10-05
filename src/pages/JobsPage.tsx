import React, { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness, Search, MapPin, Send, Plus, Loader2, Wrench, UserRound,
  ClipboardList, ArrowRight, CheckCircle2, Clock3, MessageCircle, X, ShieldCheck, FileText
} from 'lucide-react';
import {
  addDoc, collection, getDocs, query, where, serverTimestamp, doc, setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Job = {
  id: string;
  title: string;
  companyName?: string;
  category?: string;
  location?: string;
  employmentType?: string;
  description?: string;
  employerUid: string;
  salary?: string;
};

type Service = {
  id: string;
  ownerUid?: string;
  providerName?: string;
  title?: string;
  category?: string;
  description?: string;
  price?: number;
  currency?: string;
  durationHours?: number;
  status?: string;
};

type WorkTab = 'jobs' | 'services' | 'professionals' | 'request' | 'work';

const categories = [
  'Professional & Office', 'Skilled & Handwork', 'Home & Personal Services',
  'Technology', 'Construction & Engineering', 'Transport & Logistics',
  'Creative', 'Agriculture', 'Education', 'Hospitality', 'Beauty & Wellness',
  'Healthcare', 'Other',
];

const serviceSearchWords = [
  'electrician', 'plumber', 'carpenter', 'mechanic', 'cleaner', 'designer',
  'developer', 'accountant', 'consultant', 'engineer', 'photographer',
  'driver', 'tailor', 'barber', 'technician', 'professional',
];

export default function JobsPage() {
  const { currentUser, userData, hasRole } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestingService, setRequestingService] = useState<Service | null>(null);
  const [hireBusy, setHireBusy] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [agreementRequest, setAgreementRequest] = useState<any | null>(null);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [tab, setTab] = useState<WorkTab>('jobs');
  const [queryText, setQueryText] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestForm, setRequestForm] = useState({
    title: '', category: 'Skilled & Handwork', location: '', requiredDate: '', budget: '', description: ''
  });

  const canPublish = hasRole('business_owner') || hasRole('administrator');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [jobSnap, serviceSnap] = await Promise.all([
        getDocs(query(collection(db, 'jobs'), where('status', '==', 'published'))),
        getDocs(query(collection(db, 'services'), where('status', '==', 'published'))),
      ]);
      setJobs(jobSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Job, 'id'>) })));
      setServices(serviceSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) })));
    } catch (err: any) {
      setError(err?.message || 'Could not load Jobs & Services.');
    } finally {
      setLoading(false);
    }
  };

  const loadMyWork = async () => {
    if (!currentUser) {
      setApplications([]);
      return;
    }
    try {
      const snap = await getDocs(query(
        collection(db, 'jobApplications'),
        where('applicantUid', '==', currentUser.uid),
      ));
      setApplications(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      const requestSnap = await getDocs(query(collection(db, 'professionalRequests'), where('requesterUid', '==', currentUser.uid)));
      setRequests(requestSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      const incomingSnap = await getDocs(query(collection(db, 'serviceRequests'), where('providerUid', '==', currentUser.uid)));
      setIncomingRequests(incomingSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      const agreementSnap = await getDocs(query(collection(db, 'workAgreements'), where('clientUid', '==', currentUser.uid)));
      const providerAgreementSnap = await getDocs(query(collection(db, 'workAgreements'), where('providerUid', '==', currentUser.uid)));
      const merged = [...agreementSnap.docs, ...providerAgreementSnap.docs].map(d => ({ id: d.id, ...(d.data() as any) }));
      setAgreements(Array.from(new Map(merged.map(item => [item.id, item])).values()));
    } catch (err: any) {
      setError(err?.message || 'Could not load My Work.');
    }
  };

  useEffect(() => { void loadData(); }, []);
  useEffect(() => { void loadMyWork(); }, [currentUser?.uid]);

  const filteredJobs = useMemo(() => {
    const text = queryText.trim().toLowerCase();
    return jobs.filter(job => {
      const haystack = [job.title, job.companyName, job.category, job.location, job.employmentType, job.description]
        .filter(Boolean).join(' ').toLowerCase();
      return (category === 'all' || job.category === category) && (!text || haystack.includes(text));
    });
  }, [jobs, queryText, category]);

  const filteredServices = useMemo(() => {
    const text = queryText.trim().toLowerCase();
    return services.filter(service => {
      const haystack = [service.title, service.providerName, service.category, service.description]
        .filter(Boolean).join(' ').toLowerCase();
      return (category === 'all' || service.category === category) && (!text || haystack.includes(text));
    });
  }, [services, queryText, category]);

  const professionals = useMemo(() => {
    const seen = new Set<string>();
    return services.filter(service => {
      const key = service.ownerUid || service.providerName || service.id;
      if (seen.has(key)) return false;
      seen.add(key);
      const text = queryText.trim().toLowerCase();
      const haystack = [service.providerName, service.title, service.category, service.description]
        .filter(Boolean).join(' ').toLowerCase();
      const isProfessional = serviceSearchWords.some(word => haystack.includes(word));
      return isProfessional && (!text || haystack.includes(text)) && (category === 'all' || service.category === category);
    });
  }, [services, queryText, category]);

  const apply = async (job: Job) => {
    if (!currentUser) { window.location.href = '/login'; return; }
    if (job.employerUid === currentUser.uid) {
      setError('You cannot apply to your own job posting.');
      return;
    }
    setApplying(job.id);
    setError('');
    try {
      const applicationId = currentUser.uid + '_' + job.id;
      await setDoc(doc(db, 'jobApplications', applicationId), {
        id: applicationId, jobId: job.id, applicantUid: currentUser.uid,
        employerUid: job.employerUid, status: 'submitted',
        applicantName: userData?.fullName || '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: false });
      await loadMyWork();
    } catch (err: any) {
      setError(err?.code === 'permission-denied'
        ? 'You have already applied or cannot apply to this job.'
        : (err?.message || 'Could not submit application.'));
    } finally {
      setApplying(null);
    }
  };

  const createJob = async () => {
    if (!currentUser) { window.location.href = '/login'; return; }
    if (!canPublish) {
      setError('Public job and service publishing is reserved for Business accounts and Unique One Admin.');
      return;
    }
    const title = window.prompt('Job or service title');
    if (!title?.trim()) return;
    const companyName = window.prompt('Business or employer name') || '';
    const location = window.prompt('Location (or Remote)') || '';
    const description = window.prompt('Short job/service description') || '';
    try {
      await addDoc(collection(db, 'jobs'), {
        title: title.trim().slice(0, 160), companyName: companyName.trim().slice(0, 160),
        location: location.trim().slice(0, 160), description: description.trim().slice(0, 3000),
        category: 'Other', employmentType: 'full_time', employerUid: currentUser.uid,
        status: 'published', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not publish the job.');
    }
  };

  const hireService = async () => {
    if (!currentUser || !requestingService) { window.location.href = '/login'; return; }
    setHireBusy(true); setError('');
    try {
      await addDoc(collection(db, 'serviceRequests'), { requesterUid: currentUser.uid, requesterName: userData?.fullName || '', providerUid: requestingService.ownerUid || '', serviceId: requestingService.id, serviceTitle: requestingService.title || 'Service request', providerName: requestingService.providerName || '', status: 'requested', paymentStatus: 'unpaid', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setRequestingService(null); setTab('work'); setError('Hire request sent. The provider can respond before work begins.'); await loadMyWork();
    } catch (err: any) { setError(err?.message || 'Could not send the hire request.'); } finally { setHireBusy(false); }
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) { window.location.href = '/login'; return; }
    if (!requestForm.title.trim() || !requestForm.description.trim()) {
      setError('Add what you need and describe the work.');
      return;
    }
    setRequestBusy(true);
    setError('');
    try {
      await addDoc(collection(db, 'professionalRequests'), {
        requesterUid: currentUser.uid,
        requesterName: userData?.fullName || '',
        title: requestForm.title.trim().slice(0, 160),
        category: requestForm.category,
        location: requestForm.location.trim().slice(0, 160),
        requiredDate: requestForm.requiredDate,
        budget: requestForm.budget.trim().slice(0, 80),
        description: requestForm.description.trim().slice(0, 3000),
        status: 'published',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowRequest(false);
      setRequestForm({ title: '', category: 'Skilled & Handwork', location: '', requiredDate: '', budget: '', description: '' });
      setTab('work');
      setError('Request posted. Suitable professionals can respond when this request is connected to the provider workflow.');
    } catch (err: any) {
      setError(err?.message || 'Could not submit the professional request.');
    } finally {
      setRequestBusy(false);
    }
  };

  const tabs: Array<{ id: WorkTab; label: string; icon: React.ElementType }> = [
    { id: 'jobs', label: 'Find Jobs', icon: BriefcaseBusiness },
    { id: 'services', label: 'Find Services', icon: Wrench },
    { id: 'professionals', label: 'Find Professionals', icon: UserRound },
    { id: 'request', label: 'Request a Professional', icon: ClipboardList },
    { id: 'work', label: 'My Work', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5 pb-12">
      <section className="rounded-3xl bg-slate-950 p-5 text-white md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Unique One • Jobs & Services</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Find work. Find a professional. Get work done.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Find jobs, services and professionals — then move from request or application to communication, agreement, work, payment and review.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowRequest(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">
              <ClipboardList className="h-4 w-4" /> Request a Professional
            </button>
            <button onClick={() => void createJob()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950">
              <Plus className="h-4 w-4" /> Post a job or service
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {['Discover', 'Match', 'Connect', 'Work & Complete'].map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <span className="text-emerald-300">0{index + 1}</span><p className="mt-1 font-bold">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => id === 'request' ? setShowRequest(true) : setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${tab === id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </section>

      {(tab !== 'work') && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input value={queryText} onChange={e => setQueryText(e.target.value)}
                placeholder={tab === 'jobs' ? 'Search jobs, employers, skills or locations...' : 'Search professionals, services, skills or categories...'}
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-emerald-400" />
            </label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3">
              <option value="all">All categories</option>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {['all', ...categories.slice(0, 8)].map(item => (
              <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${category === item ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                {item === 'all' ? 'All' : item}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}

      {loading && tab !== 'work' ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div>
      ) : tab === 'jobs' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredJobs.map(job => (
            <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-lg font-black">{job.title}</h2><p className="mt-1 text-sm text-slate-500">{job.companyName || 'Employer not specified'}</p></div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold">{job.employmentType || 'Opportunity'}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>}
                {job.category && <span>{job.category}</span>}
                {job.salary && <span>{job.salary}</span>}
              </div>
              {job.description && <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">{job.description}</p>}
              <div className="mt-5 flex gap-2">
                <button onClick={() => void apply(job)} disabled={applying === job.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                  {applying === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Apply
                </button>
                <button onClick={() => window.location.href = '/os/messages'} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"><MessageCircle className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </section>
      ) : tab === 'services' ? (
        <ServiceGrid services={filteredServices} onRequest={(service) => setRequestingService(service)} />
      ) : tab === 'professionals' ? (
        <ServiceGrid services={professionals} onRequest={() => setShowRequest(true)} professionalMode />
      ) : tab === 'work' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="font-black">My applications</h2></div>
            {applications.length === 0 ? <p className="mt-4 text-sm text-slate-500">Your job applications will appear here.</p> :
              <div className="mt-4 space-y-3">{applications.map(item => (
                <div key={item.id} className="rounded-xl bg-slate-50 p-4">
                  <p className="font-bold">{item.jobId || 'Job application'}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.status || 'submitted'}</p>
                </div>
              ))}</div>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-black">Provider requests</h2></div>
            {incomingRequests.length === 0 ? <p className="mt-4 text-sm text-slate-500">Client hire requests will appear here.</p> :
              <div className="mt-4 space-y-3">{incomingRequests.map(item =>
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.serviceTitle || 'Service request'}</p><p className="mt-1 text-xs text-slate-500">Client: {item.requesterName || 'Client'}</p></div><span className="text-xs font-bold">{item.status || 'requested'}</span></div>
                  {item.status === 'requested' && <div className="mt-3 flex gap-2"><button onClick={async () => { await setDoc(doc(db, 'serviceRequests', item.id), { status: 'accepted', respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); await loadMyWork(); setAgreementRequest(item); }} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Accept</button><button onClick={async () => { await setDoc(doc(db, 'serviceRequests', item.id), { status: 'declined', respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); await loadMyWork(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Decline</button></div>}
                  {item.status === 'accepted' && <button onClick={() => setAgreementRequest(item)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"><FileText className="h-4 w-4" /> Create free agreement</button>}
                </div>)}</div>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-black">Work agreements</h2><FileText className="h-5 w-5 text-emerald-600" /></div>
            {agreements.length === 0 ? <p className="mt-4 text-sm text-slate-500">Your agreements will appear here after a provider accepts a hire request.</p> :
              <div className="mt-4 space-y-3">{agreements.map(item => {
                const isProvider = item.providerUid === currentUser?.uid;
                const myAccepted = isProvider ? item.providerAccepted : item.clientAccepted;
                const otherAccepted = isProvider ? item.clientAccepted : item.providerAccepted;
                return <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.currency || 'NGN'} {item.price}</p></div><span className="text-xs font-bold">{item.status || 'pending_acceptance'}</span></div>
                  <p className="mt-2 text-xs text-slate-500">{myAccepted ? 'You accepted' : 'Your acceptance pending'} · {otherAccepted ? 'Other party accepted' : 'Other party pending'}</p>
                  {!myAccepted && <button onClick={async () => { await setDoc(doc(db, 'workAgreements', item.id), { [isProvider ? 'providerAccepted' : 'clientAccepted']: true, updatedAt: serverTimestamp(), status: otherAccepted ? 'active' : 'pending_acceptance' }, { merge: true }); await loadMyWork(); }} className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Accept agreement</button>}
                  {myAccepted && otherAccepted && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">Agreement active — work can begin. Payment can be arranged through UniquePay after the agreed terms are confirmed.</div>}
                </div>;
              })}</div>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-black">Your work lifecycle</h2>
            <div className="mt-4 space-y-3">{['Application / Request', 'Communication', 'Agreement & scope', 'Work / milestones', 'Completion', 'UniquePay settlement', 'Review & reputation'].map((item, i) =>
              <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">{i + 1}</span><span className="text-sm font-semibold">{item}</span></div>
            )}</div>
          </div>
        </section>
      ) : null}

      {!loading && tab !== 'work' && ((tab === 'jobs' && filteredJobs.length === 0) || (tab === 'services' && filteredServices.length === 0) || (tab === 'professionals' && professionals.length === 0)) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 font-black">No matching published records yet</h2>
          <p className="mt-2 text-sm text-slate-500">Unique Jobs & Services shows real published records only. You can request what you need instead.</p>
          <button onClick={() => setShowRequest(true)} className="mt-5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Request a Professional</button>
        </div>
      )}

      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Unique Jobs & Services</p><h2 className="mt-1 text-2xl font-black">Request a Professional</h2><p className="mt-2 text-sm text-slate-500">Tell us what you need. The request is structured for provider matching.</p></div><button onClick={() => setShowRequest(false)} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitRequest} className="mt-5 space-y-4">
              <input required value={requestForm.title} onChange={e => setRequestForm({...requestForm, title: e.target.value})} placeholder="What do you need? e.g. Plumber to fix leaking pipe" className="w-full rounded-xl border border-slate-200 p-3 outline-none" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={requestForm.category} onChange={e => setRequestForm({...requestForm, category: e.target.value})} className="rounded-xl border border-slate-200 p-3">{categories.map(item => <option key={item}>{item}</option>)}</select>
                <input value={requestForm.location} onChange={e => setRequestForm({...requestForm, location: e.target.value})} placeholder="Location / Remote" className="rounded-xl border border-slate-200 p-3" />
                <input type="date" value={requestForm.requiredDate} onChange={e => setRequestForm({...requestForm, requiredDate: e.target.value})} className="rounded-xl border border-slate-200 p-3" />
                <input value={requestForm.budget} onChange={e => setRequestForm({...requestForm, budget: e.target.value})} placeholder="Budget (optional)" className="rounded-xl border border-slate-200 p-3" />
              </div>
              <textarea required rows={5} value={requestForm.description} onChange={e => setRequestForm({...requestForm, description: e.target.value})} placeholder="Describe the work, skills needed, timing, materials, or other requirements..." className="w-full rounded-xl border border-slate-200 p-3 outline-none" />
              <button disabled={requestBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50">{requestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Submit request</button>
            </form>
          </div>
        </div>
      )}

      {requestingService && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Hire request</p><h2 className="mt-1 text-xl font-black">{requestingService.title || 'Service'}</h2><p className="mt-1 text-sm text-slate-500">{requestingService.providerName || 'Provider'}</p></div><button onClick={() => setRequestingService(null)}><X /></button></div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm"><p>Request this provider first. They can accept, decline or respond before any work or payment starts.</p><p className="mt-2 font-bold">Payment is not taken at this stage.</p></div>
            <button disabled={hireBusy} onClick={() => void hireService()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white">{hireBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Send hire request</button>
          </div>
        </div>
      )}

      {agreementRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (!currentUser || !agreementRequest) return;
            const form = new FormData(event.currentTarget);
            const title = String(form.get('title') || '').trim();
            const scope = String(form.get('scope') || '').trim();
            const price = String(form.get('price') || '').trim();
            if (!title || !scope || !price) { setError('Add the agreement title, scope and agreed price.'); return; }
            try {
              await addDoc(collection(db, 'workAgreements'), {
                serviceRequestId: agreementRequest.id, clientUid: agreementRequest.requesterUid, providerUid: agreementRequest.providerUid,
                serviceId: agreementRequest.serviceId, title, scope, price, currency: String(form.get('currency') || 'NGN'),
                startDate: String(form.get('startDate') || ''), completionDate: String(form.get('completionDate') || ''),
                responsibilities: String(form.get('responsibilities') || '').trim(), cancellationTerms: String(form.get('cancellationTerms') || '').trim(),
                status: 'pending_acceptance', clientAccepted: false, providerAccepted: false, createdByUid: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
              });
              setAgreementRequest(null); setTab('work'); setError('Free agreement created. Both parties should accept it before work or payment begins.');
            } catch (err: any) { setError(err?.message || 'Could not create the agreement.'); }
          }} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Free agreement</p><h2 className="mt-1 text-2xl font-black">Agree the work before payment</h2><p className="mt-2 text-sm text-slate-500">No subscription or agreement fee. Set scope, price and responsibilities clearly.</p></div><button type="button" onClick={() => setAgreementRequest(null)}><X className="h-5 w-5" /></button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input name="title" required placeholder="Agreement title" className="rounded-xl border border-slate-200 p-3 sm:col-span-2" />
              <textarea name="scope" required rows={4} placeholder="Scope of work / deliverables" className="rounded-xl border border-slate-200 p-3 sm:col-span-2" />
              <input name="price" required placeholder="Agreed price e.g. 35000" className="rounded-xl border border-slate-200 p-3" />
              <select name="currency" className="rounded-xl border border-slate-200 p-3"><option>NGN</option><option>USD</option><option>GBP</option></select>
              <input name="startDate" type="date" className="rounded-xl border border-slate-200 p-3" />
              <input name="completionDate" type="date" className="rounded-xl border border-slate-200 p-3" />
              <textarea name="responsibilities" rows={3} placeholder="Responsibilities / materials / access" className="rounded-xl border border-slate-200 p-3 sm:col-span-2" />
              <textarea name="cancellationTerms" rows={3} placeholder="Cancellation or change terms" className="rounded-xl border border-slate-200 p-3 sm:col-span-2" />
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">Free to create. Payment should only proceed after the agreement is accepted.</div>
            <button className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-bold text-white">Create free agreement</button>
          </form>
        </div>
      )}

      {!canPublish && <p className="text-center text-xs text-slate-400">Public job and service publishing is reserved for Business accounts and Unique One Admin. Personal users can search, apply, request and hire.</p>}
    </div>
  );
}

function ServiceGrid({ services, onRequest, professionalMode = false }: { services: Service[]; onRequest: (service: Service) => void; professionalMode?: boolean }) {
  return <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {services.map(service => (
      <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{professionalMode ? 'Professional' : 'Service'}</span>
            <h2 className="mt-3 text-lg font-black">{service.title || 'Unique service'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">{service.providerName || 'Unique provider'}</p></div>
          <UserRound className="h-5 w-5 text-emerald-600" />
        </div>
        <p className="mt-3 text-xs text-slate-500">{service.category || 'Professional Services'}</p>
        {service.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">{service.description}</p>}
        <div className="mt-5 flex items-center justify-between"><span className="font-black text-emerald-700">{service.price ? `${service.currency === 'NGN' ? '₦' : '$'}${Number(service.price).toLocaleString()}` : 'Request quote'}</span>{service.durationHours ? <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{service.durationHours}h</span> : null}</div>
        <div className="mt-5 flex gap-2"><button onClick={() => onRequest(service)} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white">Request / Hire</button>{service.ownerUid && <button onClick={() => window.location.href = '/os/messages'} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700">Message</button>}</div>
      </article>
    ))}
  </section>;
}
