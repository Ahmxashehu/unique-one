import React, { useState } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userSnapshot = await getDoc(doc(db, 'users', credential.user.uid));
      const roles = userSnapshot.exists() ? userSnapshot.data().roles : [];

      const adminRoles = ['super_admin', 'platform_admin', 'administrator'];
      if (!Array.isArray(roles) || !roles.some((role: unknown) => adminRoles.includes(String(role)))) {
        await signOut(auth);
        throw new Error('This account does not have authorized Control Tower access.');
      }

      const destination = roles.includes('super_admin') ? '/admin/control-tower' : roles.includes('platform_admin') ? '/admin/workspace/platform' : '/admin/requests';
      navigate(destination, { replace: true });
    } catch (loginError) {
      console.error('Admin login failed:', loginError);
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in to the admin portal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-6 h-6 text-slate-900" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Unique Control Tower</h1>
        <p className="text-slate-500 mt-2">Secure access for authorized platform administrators.</p>

        {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="admin@unique.one" disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="••••••••" disabled={loading} />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white rounded-xl py-3 font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Access Portal</span><ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
