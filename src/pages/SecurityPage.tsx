import React, { useState } from 'react';
import { Shield, Key, Smartphone, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function SecurityPage() {
  const { userData, currentUser } = useAuth();
  const [resetSent, setResetSent] = useState(false);

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err) {
      console.error(err);
      alert('Failed to send reset email.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Security & Authentication</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account security, passwords, and authentication.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-slate-500" /> Password & PIN
        </h2>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-xl">
            <div>
              <p className="font-medium text-slate-900">Account Password</p>
              <p className="text-sm text-slate-500">Reset through Firebase Authentication.</p>
            </div>
            <button onClick={handlePasswordReset} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">
              {resetSent ? 'Email Sent!' : 'Reset Password'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-xl">
            <div>
              <p className="font-medium text-slate-900">Transaction PIN</p>
              <p className="text-sm text-slate-500">
                {userData?.hasSecurePin ? 'Secure PIN is active' : 'No PIN set yet (Required for UniquePay)'}
              </p>
            </div>
            <button className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors">
              {userData?.hasSecurePin ? 'Change PIN' : 'Setup PIN'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">Two-Factor Authentication (2FA)</p>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded uppercase tracking-wider">Beta</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Production MFA/TOTP integration is not enabled yet.</p>
            </div>
            <button disabled className="px-4 py-2 border border-slate-300 text-slate-400 font-medium rounded-lg cursor-not-allowed">Coming Soon</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-slate-500" /> Active Session
        </h2>
        <div className="flex items-start gap-4 p-4 border border-green-200 bg-green-50 rounded-xl">
          <Smartphone className="w-6 h-6 text-green-600 shrink-0 mt-1" />
          <div>
            <p className="font-medium text-slate-900">Current Firebase Authentication session</p>
            <p className="text-sm text-slate-600 mt-1">Signed in as {currentUser?.email || 'the authenticated account'}.</p>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Session state is managed by Firebase Authentication.
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Device-level session history and remote revocation are not represented here until a real server-managed session system is implemented.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-500" /> Identity Verification
        </h2>
        <div className="flex items-start gap-4 p-4 border border-amber-200 bg-amber-50 rounded-xl">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-900">Your account is currently {userData?.verificationStatus?.replace('_', ' ') || 'unverified'}</p>
            <p className="text-sm text-slate-600 mt-1">To unlock higher payment limits in UniquePay and register a business, you must complete the required verification.</p>
            <button className="mt-3 px-4 py-2 bg-amber-100 text-amber-800 font-semibold rounded-lg hover:bg-amber-200 transition-colors text-sm">Start Verification</button>
          </div>
        </div>
      </div>
    </div>
  );
}
