import React, { useEffect, useState } from 'react';
import { Building2, KeyRound, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import BusinessRegisterPage from '../../pages/business/BusinessRegisterPage';

type Membership = { businessId: string; businessName: string; role: string; status: string };
type Status = {
  approved: boolean;
  memberships: Membership[];
  selectedBusiness?: Membership;
  hasCredential?: boolean;
  credentialStatus?: string;
  sessionValid?: boolean;
};

const SESSION_KEY = 'unique_business_session';

async function api(firebaseUser: NonNullable<ReturnType<typeof useAuth>['currentUser']>, path: string, options: RequestInit = {}) {
  const idToken = await getIdToken(firebaseUser);
  const current = options.headers instanceof Headers ? Object.fromEntries(options.headers.entries()) : (options.headers || {});
  const businessSession = localStorage.getItem(SESSION_KEY) || '';
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(businessSession ? { 'X-Business-Session': businessSession } : {}),
      ...current,
    },
  });
}

export function BusinessAccessGuard({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const response = await api(currentUser, '/api/business/access/status');
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to check Business Platform access.');
      setStatus(result);
      const selected = result?.selectedBusiness?.businessId || result?.memberships?.[0]?.businessId || '';
      setBusinessId((current) => current || selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check Business Platform access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [currentUser]);

  const submit = async (mode: 'setup' | 'login') => {
    if (!currentUser) return;
    setWorking(true);
    setError('');
    try {
      if (mode === 'setup' && password !== confirmPassword) throw new Error('The passwords do not match.');
      const response = await api(currentUser, `/api/business/access/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ businessId, password }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'Business access could not be completed.');
      if (mode === 'login' && result?.token) localStorage.setItem(SESSION_KEY, result.token);
      setPassword('');
      setConfirmPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business access could not be completed.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="min-h-[55vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>;
  }

  if (!status?.approved) return <BusinessRegisterPage />;

  const selected = status.selectedBusiness || status.memberships.find((item) => item.businessId === businessId) || status.memberships[0];
  const needsSetup = !status.hasCredential || status.credentialStatus === 'reset_required';

  if (!status.sessionValid) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-slate-950 text-white p-7">
            <div className="flex items-center gap-3"><ShieldCheck className="w-7 h-7 text-emerald-400" /><div><p className="text-xs uppercase tracking-[0.18em] text-emerald-300 font-bold">Protected Workspace</p><h1 className="text-2xl font-bold">Business Platform Access</h1></div></div>
            <p className="text-slate-300 text-sm mt-3">Your Personal Account identifies you. A separate Business password unlocks organization tools.</p>
          </div>
          <div className="p-7 space-y-5">
            {status.memberships.length > 1 && <div><label className="block text-sm font-semibold text-slate-700 mb-2">Business / Organization</label><select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3">{status.memberships.map((item) => <option key={item.businessId} value={item.businessId}>{item.businessName} · {item.role.replaceAll('_',' ')}</option>)}</select></div>}
            {selected && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3"><Building2 className="w-5 h-5 text-emerald-700 mt-0.5" /><div><p className="font-bold text-slate-900">{selected.businessName}</p><p className="text-xs text-slate-600 mt-1">{selected.role.replaceAll('_',' ')}</p></div></div>}
            {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 p-3 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{needsSetup ? 'Create Business Password' : 'Business Password'}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="8+ chars, upper/lower/number/special" autoComplete={needsSetup ? 'new-password' : 'current-password'} />
              {needsSetup && <><label className="block text-sm font-semibold text-slate-700 mt-4 mb-2">Confirm Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3" autoComplete="new-password" /></>}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">Minimum 8 characters. Use uppercase + lowercase + number + special character. Unique One stores only a secure password hash; Super Admin cannot see your password.</div>
            <button disabled={working || !businessId || !password} onClick={() => void submit(needsSetup ? 'setup' : 'login')} className="w-full rounded-xl bg-slate-950 text-white py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {working ? <Loader2 className="w-5 h-5 animate-spin" /> : needsSetup ? <><KeyRound className="w-5 h-5" /> Create Business Password</> : <><LogIn className="w-5 h-5" /> Unlock Business Dashboard</>}
            </button>
            <p className="text-center text-xs text-slate-500">Separate from your Personal Account 6-digit login password.</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default BusinessAccessGuard;
