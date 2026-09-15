import React, { useState } from 'react';
import { Shield, Key, Smartphone, Laptop, Clock, Lock, AlertCircle } from 'lucide-react';
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
        <p className="text-sm text-slate-500 mt-1">Manage your account security, passwords, and sessions.</p>
      </div>

      {/* Password & Authentication */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-slate-500" /> Password & PIN
        </h2>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-xl">
            <div>
              <p className="font-medium text-slate-900">Account Password</p>
              <p className="text-sm text-slate-500">Last changed recently</p>
            </div>
            <button 
              onClick={handlePasswordReset}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              {resetSent ? 'Email Sent!' : 'Reset Password'}
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-xl">
            <div>
              <p className="font-medium text-slate-900">Transaction PIN</p>
              <p className="text-sm text-slate-500">
                {userData?.hasSecurePin ? 'Secure 4-digit PIN is active' : 'No PIN set yet (Required for UniquePay)'}
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
              <p className="text-sm text-slate-500 mt-1">Add an extra layer of security using an authenticator app or SMS.</p>
            </div>
            <button className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors">
              Enable 2FA
            </button>
          </div>
        </div>
      </div>

      {/* Connected Devices */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-slate-500" /> Active Sessions
        </h2>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-4 border border-green-200 bg-green-50 rounded-xl">
            <div className="flex gap-4">
              <div className="mt-1"><Laptop className="w-6 h-6 text-green-600" /></div>
              <div>
                <p className="font-medium text-slate-900 flex items-center gap-2">Current Device <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span></p>
                <p className="text-sm text-slate-600">Chrome on Windows • IP: 192.168.1.1</p>
                <p className="text-xs text-slate-500 mt-1">Started: {new Date(userData?.lastLogin || Date.now()).toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-start justify-between gap-4 p-4 border border-slate-100 rounded-xl">
            <div className="flex gap-4">
              <div className="mt-1"><Smartphone className="w-6 h-6 text-slate-400" /></div>
              <div>
                <p className="font-medium text-slate-900">Mobile App (Android)</p>
                <p className="text-sm text-slate-500">Unique One App • Lagos, NG</p>
                <p className="text-xs text-slate-400 mt-1">Last active: 2 days ago</p>
              </div>
            </div>
            <button className="text-sm text-red-600 font-medium hover:underline">Revoke</button>
          </div>
        </div>
      </div>

      {/* Account Verification */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-500" /> Identity Verification
        </h2>
        <div className="flex items-start gap-4 p-4 border border-amber-200 bg-amber-50 rounded-xl">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-900">Your account is currently {userData?.verificationStatus.replace('_', ' ')}</p>
            <p className="text-sm text-slate-600 mt-1">To unlock higher payment limits in UniquePay and register a business, you must complete full KYC verification (BVN/NIN).</p>
            <button className="mt-3 px-4 py-2 bg-amber-100 text-amber-800 font-semibold rounded-lg hover:bg-amber-200 transition-colors text-sm">
              Start Verification
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
