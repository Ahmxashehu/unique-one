import React, { useMemo, useState } from 'react';
import { Shield, Key, Smartphone, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SecurityPage() {
  const { userData, currentUser } = useAuth();
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmNewPassword,setConfirmNewPassword]=useState('');
  const [passwordMessage,setPasswordMessage]=useState('');
  const [passwordError,setPasswordError]=useState('');
  const [passwordLoading,setPasswordLoading]=useState(false);
  const weakLoginPins=new Set(['000000','111111','123456','654321','121212','112233','123123']);
  const passwordChecks=useMemo(()=>[{ok:/^\\d{6}$/.test(newPassword),label:'Exactly 6 digits'},{ok:newPassword.length===6&&!weakLoginPins.has(newPassword),label:'Avoid obvious or common patterns'},{ok:newPassword.length===6&&newPassword!==currentPassword,label:'Different from your current Login PIN'}],[newPassword,currentPassword]);
  const handlePasswordChange=async()=>{
    setPasswordError('');setPasswordMessage('');
    if(!/^\\d{6}$/.test(currentPassword)){setPasswordError('Enter your current 6-digit Login PIN.');return;}
    if(!/^\\d{6}$/.test(newPassword)||weakLoginPins.has(newPassword)){setPasswordError('Choose a valid 6-digit Login PIN that is not an obvious pattern.');return;}
    if(newPassword!==confirmNewPassword){setPasswordError('The new Login PINs do not match.');return;}
    if(!currentUser){setPasswordError('Your session has expired. Please sign in again.');return;}
    setPasswordLoading(true);
    try{
      const token=await currentUser.getIdToken();
      const r=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({currentPassword,newPassword,confirmNewPassword})});
      const b=await r.json();if(!r.ok)throw new Error(b?.error?.message||'Login PIN could not be changed.');
      setCurrentPassword('');setNewPassword('');setConfirmNewPassword('');setPasswordMessage('Your 6-digit Login PIN has been changed successfully.');
    }catch(err:any){setPasswordError(err.message||'Login PIN could not be changed.');}finally{setPasswordLoading(false);}
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
          <div className="p-4 border border-slate-100 rounded-xl space-y-4">
            <div>
              <p className="font-medium text-slate-900">Change 6-digit Login PIN</p>
              <p className="text-sm text-slate-500">Enter your current Login PIN, then choose and confirm a new one.</p>
            </div>
            {passwordError&&<div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{passwordError}</div>}
            {passwordMessage&&<div className="p-3 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm">{passwordMessage}</div>}
            <input type="password" inputMode="numeric" maxLength={6} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value.replace(/\\D/g,''))} placeholder="Current 6-digit Login PIN" className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="current-password"/>
            <input type="password" inputMode="numeric" maxLength={6} value={newPassword} onChange={e=>setNewPassword(e.target.value.replace(/\\D/g,''))} placeholder="New 6-digit Login PIN" className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="new-password"/>
            <div className="space-y-1">{passwordChecks.map(item=><p key={item.label} className={`text-xs ${item.ok?'text-green-600':'text-slate-500'}`}>{item.ok?'✓':'○'} {item.label}</p>)}</div>
            <input type="password" inputMode="numeric" maxLength={6} value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value.replace(/\\D/g,''))} placeholder="Confirm new 6-digit Login PIN" className="w-full px-4 py-3 border border-slate-200 rounded-xl" autoComplete="new-password"/>
            <button onClick={handlePasswordChange} disabled={passwordLoading} className="px-4 py-3 bg-slate-900 text-white font-medium rounded-xl disabled:opacity-50">{passwordLoading?'Updating...':'Change Login PIN'}</button>
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
