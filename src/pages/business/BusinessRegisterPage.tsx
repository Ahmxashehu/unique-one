import React, { useEffect, useState } from 'react';
import { Building2, ArrowRight, Loader2, AlertCircle, CheckCircle2, Clock3, LogIn, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

type Application = {
  id: string;
  applicationType: 'create_business' | 'join_business';
  name: string;
  organizationName?: string | null;
  requestedRole: string;
  status: 'pending' | 'approved' | 'declined';
  reviewNote?: string;
  createdAt?: { _seconds?: number } | string;
};

const ROLE_OPTIONS = [
  { value: 'business_owner', label: 'Business Owner', description: 'Own and manage a business or organization.' },
  { value: 'seller', label: 'Seller', description: 'Manage marketplace products, inventory and orders.' },
  { value: 'staff_member', label: 'Staff / Employee', description: 'Work inside an approved organization with assigned access.' },
  { value: 'service_provider', label: 'Service Provider', description: 'Manage services, requests, bookings and customers.' },
  { value: 'school_administrator', label: 'Institution Administrator', description: 'Manage an approved school or institution.' },
  { value: 'finance_officer', label: 'Finance Officer', description: 'Handle authorized finance and settlement operations.' },
  { value: 'risk_security_officer', label: 'Risk / Security Officer', description: 'Handle authorized verification, risk and security work.' },
];

export default function BusinessRegisterPage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [formData, setFormData] = useState({
    applicationType: 'create_business' as 'create_business' | 'join_business',
    name: '',
    organizationName: '',
    registrationNumber: '',
    description: '',
    contactEmail: userData?.email || '',
    contactPhone: userData?.phone || '',
    category: 'retail',
    requestedRole: 'business_owner',
  });

  const loadApplications = async () => {
    if (!currentUser) return;
    try {
      const token = await getIdToken(currentUser);
      const response = await fetch('/api/business/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (response.ok) setApplications(Array.isArray(result?.applications) ? result.applications : []);
    } catch {
      // The application form remains usable if history cannot be loaded.
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, [currentUser]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    setError('');

    try {
      const token = await getIdToken(currentUser);
      const response = await fetch('/api/business/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to submit business application.');

      await loadApplications();
      setFormData((current) => ({
        ...current,
        name: '',
        organizationName: '',
        registrationNumber: '',
        description: '',
      }));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to submit business application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <Building2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900">Personal Account Required</h1>
        <p className="text-slate-500 mt-2">Create or sign in to your Unique One Personal Account before joining the Business Platform.</p>
        <button onClick={() => navigate('/login')} className="mt-6 px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold inline-flex items-center gap-2">
          Sign In <LogIn className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Unique Business Platform</h1>
        <p className="text-slate-500 mt-2">Use your Personal Account to apply for an organization and the role you need.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1.35fr] gap-6">
        <div className="bg-slate-900 text-white rounded-3xl p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300 font-bold">Business Access</p>
          <h2 className="text-2xl font-bold mt-2">Choose how you want to join</h2>
          <div className="mt-6 space-y-3">
            <button type="button" onClick={() => setFormData((f) => ({ ...f, applicationType: 'create_business', requestedRole: 'business_owner' }))} className={`w-full text-left rounded-2xl p-4 border ${formData.applicationType === 'create_business' ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
              <div className="font-bold">Register my business</div>
              <div className="text-sm text-slate-300 mt-1">Create a new organization and request ownership or another authorized role.</div>
            </button>
            <button type="button" onClick={() => setFormData((f) => ({ ...f, applicationType: 'join_business', requestedRole: 'staff_member' }))} className={`w-full text-left rounded-2xl p-4 border ${formData.applicationType === 'join_business' ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
              <div className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Join an existing organization</div>
              <div className="text-sm text-slate-300 mt-1">Request access to an existing business, institution or organization.</div>
            </button>
          </div>
          <div className="mt-7 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
            <strong className="text-white">How approval works:</strong> submit → Super Admin review → approve/decline → your approved role appears in your Personal Account and Business Workspace.
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Requested Business Role</label>
              <select value={formData.requestedRole} onChange={e => setFormData({ ...formData, requestedRole: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white" disabled={loading}>
                {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <p className="text-xs text-slate-500 mt-2">{ROLE_OPTIONS.find((r) => r.value === formData.requestedRole)?.description}</p>
            </div>

            {formData.applicationType === 'join_business' ? (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Business / Organization to Join</label>
                <input required value={formData.organizationName} onChange={e => setFormData({ ...formData, organizationName: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200" placeholder="Organization name or Unique Business ID" disabled={loading} />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Business Name</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200" placeholder="Business name" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">CAC / Registration Number</label>
                  <input value={formData.registrationNumber} onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200" placeholder="Optional where applicable" disabled={loading} />
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Business Email</label>
                <input type="email" required value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200" disabled={loading} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Business Phone</label>
                <input type="tel" required value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200" disabled={loading} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Business Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white" disabled={loading}>
                  <option value="retail">Retail & E-commerce</option>
                  <option value="agriculture">Agriculture & Farming</option>
                  <option value="logistics">Logistics & Delivery</option>
                  <option value="services">Professional Services</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="real_estate">Real Estate & Property</option>
                  <option value="education">Education & Institutions</option>
                  <option value="technology">Technology</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Business Description</label>
                <input required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200" placeholder="What does the organization do?" disabled={loading} />
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Verification documents</p>
              <p className="text-xs text-slate-500 mt-1">The application records the request first. Required documents and verification steps can be completed as requested by the review team.</p>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-2 disabled:opacity-70">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Submit Application <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">My Business Applications</h2>
            <p className="text-sm text-slate-500">Track submissions made from your Personal Account.</p>
          </div>
          <Clock3 className="w-5 h-5 text-slate-400" />
        </div>
        {loadingApplications ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading application history…</div>
        ) : applications.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No business applications yet.</div>
        ) : (
          <div className="space-y-3">
            {applications.map((application) => (
              <div key={application.id} className="rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{application.name || application.organizationName || 'Business Application'}</p>
                  <p className="text-xs text-slate-500 mt-1">{application.applicationType === 'join_business' ? 'Join existing organization' : 'Register business'} · {application.requestedRole.replaceAll('_', ' ')}</p>
                  {application.reviewNote && <p className="text-xs text-slate-600 mt-2">{application.reviewNote}</p>}
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${application.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : application.status === 'declined' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                  {application.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
                  {application.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
