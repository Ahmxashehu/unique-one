import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

function normalizePhone(value: string) {
  const t = value.trim().replace(/[\s()-]/g, '');
  return t.startsWith('+') ? t : /^0\d{10}$/.test(t) ? `+234${t.slice(1)}` : t;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(0);
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(0);
  const confirmation = useRef<Awaited<ReturnType<typeof signInWithPhoneNumber>> | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  const OTP_TTL_SECONDS = 5 * 60;

  React.useEffect(() => {
    if (step !== 'otp' || otpExpiresAt === null) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setOtpRemainingSeconds(remaining);
      if (remaining === 0) {
        setError('This OTP has expired. Please request a new verification code.');
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [step, otpExpiresAt]);

  React.useEffect(() => {
    if (resendRemainingSeconds <= 0) return;
    const timer = window.setInterval(() => setResendRemainingSeconds(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendRemainingSeconds]);

  const getRecaptcha = () => {
    if (!verifier.current) {
      verifier.current = new RecaptchaVerifier(auth, 'forgot-password-recaptcha', { size: 'invisible' });
    }
    return verifier.current;
  };

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalized = normalizePhone(phone);
    if (!/^\+\d{8,15}$/.test(normalized)) {
      setError('Enter a valid registered phone number.');
      return;
    }
    setLoading(true);
    try {
      confirmation.current = await signInWithPhoneNumber(auth, normalized, getRecaptcha());
      setOtpExpiresAt(Date.now() + OTP_TTL_SECONDS * 1000);
      setOtpRemainingSeconds(OTP_TTL_SECONDS);
      setResendRemainingSeconds(30);
      setStep('otp');
    } catch (err: any) {
      verifier.current?.clear();
      verifier.current = null;
      setError(err?.message || 'We could not send the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading || resendRemainingSeconds > 0) return;
    setError('');
    setLoading(true);
    try {
      confirmation.current = await signInWithPhoneNumber(auth, normalizePhone(phone), getRecaptcha());
      setOtpExpiresAt(Date.now() + OTP_TTL_SECONDS * 1000);
      setOtpRemainingSeconds(OTP_TTL_SECONDS);
      setResendRemainingSeconds(30);
      setCode('');
    } catch (err: any) {
      verifier.current?.clear();
      verifier.current = null;
      setError(err?.message || 'We could not resend the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmation.current || !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    if (otpRemainingSeconds <= 0) {
      setError('This OTP has expired. Please request a new verification code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await confirmation.current.confirm(code);
      setStep('password');
    } catch (err: any) {
      setError(err?.message || 'The verification code is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(password)) {
      setError('Choose exactly 6 digits for your new login password.');
      return;
    }
    if (password === '000000' || password === '111111' || password === '123456' || password === '654321' || password === '121212' || password === '112233' || password === '123123') {
      setError('Choose a less predictable 6-digit password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Your 6-digit login passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user?.phoneNumber) throw new Error('Verified phone recovery session is no longer available. Please start again.');
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/phone/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone: normalizePhone(phone),
          password,
          confirmPassword,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Password reset could not be completed.');
      await signOut(auth);
      navigate('/login', { replace: true, state: { message: 'Your login password has been changed. Please sign in with your new 6-digit password.' } });
    } catch (err: any) {
      setError(err?.message || 'Password reset could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm font-bold mb-4">UNIQUE ONE SECURITY</div>
          <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
          <p className="text-slate-500 mt-2">We'll verify your registered phone before allowing a new 6-digit login password.</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">{error}</div>}

        {step === 'phone' && (
          <form onSubmit={sendCode} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Registered phone number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl" placeholder="+234 801 234 5678" autoComplete="tel" required />
            </div>
            <button disabled={loading} className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send phone OTP <ShieldCheck className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyCode} className="space-y-4">
            <div className="text-center">
              <ShieldCheck className="w-9 h-9 mx-auto text-green-600 mb-2" />
              <p className="font-semibold text-slate-900">Verify your phone</p>
              <p className="text-sm text-slate-500 mt-1">Enter the 6-digit OTP sent to your registered phone.</p>
              <p className={`text-sm font-semibold mt-3 ${otpRemainingSeconds <= 30 ? 'text-red-600' : 'text-green-700'}`} aria-live="polite">
                {otpRemainingSeconds > 0
                  ? `OTP expires in ${Math.floor(otpRemainingSeconds / 60)}:${String(otpRemainingSeconds % 60).padStart(2, '0')}`
                  : 'OTP expired'}
              </p>
            </div>
            <input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center tracking-[0.5em] text-xl py-3 border border-slate-200 rounded-xl" placeholder="••••••" autoComplete="one-time-code" required />
            <button disabled={loading || otpRemainingSeconds <= 0} className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Verifying...' : otpRemainingSeconds > 0 ? 'Verify OTP' : 'OTP expired'}</button>
            <button type="button" onClick={resendCode} disabled={loading || resendRemainingSeconds > 0} className="w-full text-sm font-semibold text-green-700 disabled:text-slate-400 disabled:cursor-not-allowed">{resendRemainingSeconds > 0 ? `Resend OTP in ${resendRemainingSeconds}s` : 'Resend OTP'}</button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={resetPassword} className="space-y-4">
            <div className="text-center">
              <KeyRound className="w-9 h-9 mx-auto text-green-600 mb-2" />
              <p className="font-semibold text-slate-900">Create a new login password</p>
              <p className="text-sm text-slate-500 mt-1">Your old password is replaced only after both new password fields match.</p>
            </div>
            <input type="password" inputMode="numeric" maxLength={6} value={password} onChange={e => setPassword(e.target.value.replace(/\D/g, ''))} className="w-full px-4 py-3 border border-slate-200 rounded-xl" placeholder="New 6-digit password" autoComplete="new-password" required />
            <input type="password" inputMode="numeric" maxLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.replace(/\D/g, ''))} className="w-full px-4 py-3 border border-slate-200 rounded-xl" placeholder="Confirm new 6-digit password" autoComplete="new-password" required />
            <button disabled={loading} className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Set new password <KeyRound className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>
        </div>
      </div>
      <div id="forgot-password-recaptcha" />
    </div>
  );
}
