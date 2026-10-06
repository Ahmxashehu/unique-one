import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FileSearch, Inbox, Loader2, XCircle, KeyRound } from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth } from '../../lib/firebase';

type Application = {
  id: string;
  name: string;
  organizationName?: string | null;
  applicationType: string;
  requestedRole: string;
  category: string;
  status: 'pending' | 'approved' | 'declined';
  description: string;
  registrationNumber?: string;
  businessId?: string | null;
  applicant?: { uid?: string; fullName?: string; email?: string; phone?: string; uniqueOneId?: string };
  reviewNote?: string;
  contactEmail?: string | null;
};

export default function AdminRequestsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken(auth.currentUser);
      const response = await fetch(`/api/admin/business-applications?status=${status}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to load applications.');
      setApplications(Array.isArray(result?.applications) ? result.applications : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status]);

  const review = async (application: Application, action: 'approve' | 'decline') => {
    if (!auth.currentUser) return;
    const reviewNote = window.prompt(action === 'approve' ? 'Optional approval note:' : 'Reason for declining this application:') ?? '';
    if (action === 'decline' && !reviewNote.trim()) return;
    setReviewing(application.id);
    setError('');
    try {
      const token = await getIdToken(auth.currentUser);
      const response = await fetch(`/api/admin/business-applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, reviewNote }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'Review action failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review action failed.');
    } finally {
      setReviewing('');
    }
  };

  const resetBusinessPassword = async (application: Application) => {
    if (!auth.currentUser || !application.applicant?.uid || !application.businessId) {
      setError('This approved application does not yet have a linked Business ID.'); return;
    }
    if (!window.confirm('Reset this Business Platform password? The user will be signed out of Business access and must create a new password.')) return;
    setReviewing(application.id);
    setError('');
    try {
      const token = await getIdToken(auth.currentUser);
      const response = await fetch('/api/admin/business-access/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: application.applicant.uid, businessId: application.businessId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'Business password reset failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business password reset failed.');
    } finally {
      setReviewing('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-bold">Business Platform</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Business Applications</h1>
        <p className="text-sm text-slate-500 mt-1">Review applications submitted from Personal Accounts before business access is granted.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'declined', 'all'] as const).map((value) => (
          <button key={value} onClick={() => setStatus(value)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${status === value ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {value === 'pending' ? 'Pending Review' : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />Loading applications…</div>
      ) : applications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">No {status === 'all' ? '' : status} applications</p>
          <p className="text-sm text-slate-500 mt-1">New Business Platform applications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <article key={application.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><FileSearch className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-slate-900">{application.name || application.organizationName || 'Business Application'}</h2></div>
                  <p className="text-sm text-slate-500 mt-1">{application.applicationType === 'join_business' ? 'Join existing organization' : 'Register new business'} · {application.requestedRole.replaceAll('_', ' ')}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold w-fit ${application.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : application.status === 'declined' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                  {application.status === 'pending' ? <Clock3 className="w-3.5 h-3.5" /> : application.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {application.status}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-5 text-sm">
                <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block text-xs">Applicant</span><strong>{application.applicant?.fullName || 'Unknown'}</strong><span className="block text-xs text-slate-500">{application.applicant?.uniqueOneId || application.applicant?.phone || application.applicant?.email}</span></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block text-xs">Category</span><strong>{application.category}</strong><span className="block text-xs text-slate-500">{application.registrationNumber || 'Registration number not supplied'}</span></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block text-xs">Contact</span><strong>{application.applicant?.phone || application.applicant?.email}</strong><span className="block text-xs text-slate-500">{application.contactEmail || 'No email supplied'}</span></div>
              </div>

              <p className="text-sm text-slate-600 mt-4">{application.description}</p>
              {application.reviewNote && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><strong>Review note:</strong> {application.reviewNote}</div>}

              <div className="mt-5 flex flex-wrap gap-2">
                {application.status === 'pending' && <>
                  <button disabled={reviewing === application.id} onClick={() => void review(application, 'approve')} className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">{reviewing === application.id ? 'Processing…' : 'Approve & Grant Role'}</button>
                  <button disabled={reviewing === application.id} onClick={() => void review(application, 'decline')} className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2.5 text-sm font-bold disabled:opacity-60">Decline</button>
                </>}
                {application.status === 'approved' && application.businessId && application.applicant?.uid && (
                  <button disabled={reviewing === application.id} onClick={() => void resetBusinessPassword(application)} className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-2.5 text-sm font-bold disabled:opacity-60 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" /> Reset Business Password
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
