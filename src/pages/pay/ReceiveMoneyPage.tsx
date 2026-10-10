import React, { useEffect, useState } from 'react';
import { ArrowDownRight, QrCode, Copy, RefreshCw, ShieldAlert } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type UserProfile = {
  uniqueOneId?: string;
  uniquePayId?: string;
};

export default function ReceiveMoneyPage() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!currentUser) {
        setProfile(null);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
        if (mounted) setProfile((snapshot.data() as UserProfile | undefined) ?? null);
      } catch (error) {
        console.error('Unable to load receiving identifiers:', error);
        if (mounted) setProfile(null);
      }
    };
    void loadProfile();
    return () => { mounted = false; };
  }, [currentUser?.uid]);

  const copyIdentifier = async (value: string | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch (error) {
      console.error('Unable to copy identifier:', error);
    }
  };

  const uniquePayId = profile?.uniquePayId;
  const uniqueOneId = profile?.uniqueOneId;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receive Money</h1>
        <p className="text-sm text-slate-500 mt-1">Add a receiving account or share your verified UniquePay details.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-8">
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Your Permanent Identifiers</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">UniquePay ID</p>
                <p className="font-medium text-slate-900 mt-0.5">{uniquePayId || 'Not assigned yet'}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyIdentifier(uniquePayId, 'UniquePay ID')}
                disabled={!uniquePayId}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                aria-label="Copy UniquePay ID"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Unique One ID</p>
                <p className="font-medium text-slate-900 mt-0.5">{uniqueOneId || 'Not assigned yet'}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyIdentifier(uniqueOneId, 'Unique One ID')}
                disabled={!uniqueOneId}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                aria-label="Copy Unique One ID"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>
          {copied && <p className="mt-2 text-xs text-emerald-600">{copied} copied.</p>}
        </div>

        <div className="pt-6 border-t border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Receiving account</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">Generate a bank account number for transfers once a supported account provider is connected and your account is eligible.</p>
            </div>
            <button type="button" onClick={() => setAccountNotice('Account generation is not connected yet. No bank account number has been created. Connect and activate a supported provider (Monnify or Paystack Dedicated Virtual Accounts), then complete the required identity checks to generate a real receiving account.')} className="shrink-0 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]">
              <RefreshCw className="w-4 h-4" /> Generate account
            </button>
          </div>

          {accountNotice && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{accountNotice}</div>}

          <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
            <QrCode className="w-24 h-24 text-slate-300" />
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-slate-900">Receiving account and QR</p>
              <p className="text-xs text-slate-500 mt-1">A live account number or payment QR appears only after provider confirmation. No placeholder account details are shown.</p>
            </div>
          </div>
        </div>

        <div className="bg-rose-50 p-4 rounded-xl flex items-start gap-3 mt-8 border border-rose-100">
          <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5" />
          <div className="text-sm text-rose-800">
            Never share your PIN, OTP, or password. Unique One will never ask you for these details to receive money.
          </div>
        </div>
      </div>
    </div>
  );
}
