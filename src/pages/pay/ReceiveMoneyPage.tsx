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
        <p className="text-sm text-slate-500 mt-1">Share your receiving details or generate a temporary payment ID.</p>
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
              <h3 className="font-semibold text-slate-900">Temporary Receiving ID</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Temporary receiving IDs will become available when the receiving-ID service is connected.
              </p>
            </div>
            <button type="button" disabled className="bg-slate-100 text-slate-400 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed">
              <RefreshCw className="w-4 h-4" /> Generate
            </button>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-center p-8 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
            <QrCode className="w-24 h-24 text-slate-300" />
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-slate-900">QR Code Readiness</p>
              <p className="text-xs text-slate-500 mt-1">Provider integration required to render a live payment QR.</p>
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
