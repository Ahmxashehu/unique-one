import React, { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { BriefcaseBusiness, Search, MapPin, Send, Plus, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Job = { id: string; title: string; companyName?: string; category?: string; location?: string; employmentType?: string; description?: string; employerUid: string; };

export default function JobsPage() {
  const { currentUser, userData } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queryText, setQueryText] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState('');
  const loadJobs = async () => {
    setLoading(true); setError('');
    try { const snapshot = await getDocs(query(collection(db, 'jobs'), where('status', '==', 'published'))); setJobs(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Job, 'id'>) }))); }
    catch (err: any) { setError(err?.message || 'Could not load jobs.'); } finally { setLoading(false); }
  };
  useEffect(() => { void loadJobs(); }, []);
  const categories = useMemo(() => Array.from(new Set(jobs.map(j => j.category).filter(Boolean) as string[])).sort(), [jobs]);
  const filteredJobs = useMemo(() => { const text = queryText.trim().toLowerCase(); return jobs.filter(job => { const haystack = [job.title, job.companyName, job.category, job.location, job.employmentType, job.description].filter(Boolean).join(' ').toLowerCase(); return (category === 'all' || job.category === category) && (!text || haystack.includes(text)); }); }, [jobs, queryText, category]);
  const apply = async (job: Job) => {
    if (!currentUser) { window.location.href = '/login'; return; }
    if (job.employerUid === currentUser.uid) { setError('You cannot apply to your own job posting.'); return; }
    setApplying(job.id); setError('');
    try { const applicationId = currentUser.uid + '_' + job.id; await setDoc(doc(db, 'jobApplications', applicationId), { id: applicationId, jobId: job.id, applicantUid: currentUser.uid, employerUid: job.employerUid, status: 'submitted', applicantName: userData?.fullName || '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: false }); }
    catch (err: any) { setError(err?.code === 'permission-denied' ? 'You have already applied or cannot apply to this job.' : (err?.message || 'Could not submit application.')); }
    finally { setApplying(null); }
  };
  const createJob = async () => {
    if (!currentUser) { window.location.href = '/login'; return; }
    const title = window.prompt('Job title'); if (!title?.trim()) return;
    const companyName = window.prompt('Company or employer name (optional)') || '';
    const location = window.prompt('Location (optional)') || '';
    const description = window.prompt('Short job description') || '';
    try { await addDoc(collection(db, 'jobs'), { title: title.trim().slice(0, 160), companyName: companyName.trim().slice(0, 160), location: location.trim().slice(0, 160), description: description.trim().slice(0, 3000), category: 'other', employmentType: 'full_time', employerUid: currentUser.uid, status: 'published', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); await loadJobs(); }
    catch (err: any) { setError(err?.message || 'Could not publish the job.'); }
  };
  return <div className='space-y-6 pb-12'>
    <div className='bg-slate-900 rounded-3xl p-6 md:p-10 text-white'><div className='flex flex-col md:flex-row md:items-end md:justify-between gap-6'><div><p className='text-sm text-slate-300'>Unique One • Jobs</p><h1 className='text-3xl md:text-4xl font-bold mt-2'>Find work. Hire people. Grow.</h1><p className='text-slate-300 mt-3'>A real jobs marketplace using published platform records only.</p></div><button onClick={() => void createJob()} className='inline-flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-900 rounded-xl font-semibold'><Plus className='w-5 h-5' /> Post a job</button></div></div>
    <div className='bg-white border border-slate-200 rounded-2xl p-4 grid md:grid-cols-[1fr_220px] gap-3'><label className='relative'><Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' /><input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder='Search jobs, employers, skills or locations...' className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none' /></label><select value={category} onChange={e => setCategory(e.target.value)} className='border border-slate-200 rounded-xl px-3 py-3'><option value='all'>All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
    {error && <div className='bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm'>{error}</div>}
    {loading ? <div className='flex justify-center p-12'><Loader2 className='w-7 h-7 animate-spin text-slate-400' /></div> : filteredJobs.length === 0 ? <div className='bg-white border border-slate-200 rounded-2xl p-12 text-center'><BriefcaseBusiness className='w-10 h-10 mx-auto text-slate-300' /><h2 className='text-lg font-semibold mt-4'>No published jobs found</h2><p className='text-sm text-slate-500 mt-2'>Try another search or publish the first real listing.</p></div> : <div className='grid lg:grid-cols-2 gap-4'>{filteredJobs.map(job => <article key={job.id} className='bg-white border border-slate-200 rounded-2xl p-5'><div className='flex items-start justify-between gap-4'><div><h2 className='font-bold text-lg'>{job.title}</h2><p className='text-sm text-slate-500 mt-1'>{job.companyName || 'Employer not specified'}</p></div><span className='text-xs px-2 py-1 rounded-full bg-slate-100'>{job.employmentType || 'unspecified'}</span></div><div className='flex flex-wrap gap-3 text-xs text-slate-500 mt-4'>{job.location && <span className='inline-flex items-center gap-1'><MapPin className='w-4 h-4' />{job.location}</span>}{job.category && <span>{job.category}</span>}</div>{job.description && <p className='text-sm text-slate-600 mt-4 line-clamp-4'>{job.description}</p>}<button onClick={() => void apply(job)} disabled={applying === job.id} className='mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-50'>{applying === job.id ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />} Apply</button></article>)}</div>}
  </div>;
}