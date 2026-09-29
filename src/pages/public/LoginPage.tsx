import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Mail, Lock, Phone, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider,
  linkWithCredential,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { UniqueUser } from '../../lib/os/types';

function normalizePhoneNumber(value: string) {
  const trimmed = value.trim().replace(/[\s()-]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (/^0\d{10}$/.test(trimmed)) return `+234${trimmed.slice(1)}`;
  return trimmed;
}

function generatedUniqueOneId(uid: string) {
  const stablePart = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  return `U1-${stablePart || 'ACCOUNT'}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'code'>('phone');
  const [phoneConfirmation, setPhoneConfirmation] = useState<Awaited<ReturnType<typeof signInWithPhoneNumber>> | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [phoneGateOpen, setPhoneGateOpen] = useState(false);
  const [gatePhone, setGatePhone] = useState('');
  const [gateCode, setGateCode] = useState('');
  const [gateStep, setGateStep] = useState<'phone' | 'code'>('phone');
  const [gateVerificationId, setGateVerificationId] = useState('');
  const [pendingUser, setPendingUser] = useState<FirebaseUser | null>(null);

  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const postLoginHandled = useRef(false);

  const from = location.state?.from?.pathname || '/os/dashboard';

  const getRecaptchaVerifier = () => {
    if (!recaptchaVerifier.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return recaptchaVerifier.current;
  };

  const clearRecaptcha = () => {
    if (recaptchaVerifier.current) {
      recaptchaVerifier.current.clear();
      recaptchaVerifier.current = null;
    }
  };

  const openPhoneGate = (user: FirebaseUser) => {
    setPendingUser(user);
    setGatePhone('');
    setGateCode('');
    setGateStep('phone');
    setGateVerificationId('');
    setPhoneGateOpen(true);
  };

  const handlePostLogin = async (user: FirebaseUser) => {
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    const existing = docSnap.exists() ? (docSnap.data() as Partial<UniqueUser>) : null;

    const verifiedPhone = user.phoneNumber || existing?.phone || '';

    if (!verifiedPhone) {
      if (existing) {
        try {
          await updateDoc(userDocRef, {
            lastLogin: new Date().toISOString(),
          });
        } catch (updateErr) {
          console.warn('Could not update last login', updateErr);
        }
      }
      openPhoneGate(user);
      return false;
    }

    if (!docSnap.exists()) {
      const osUser: UniqueUser = {
        uid: user.uid,
        email: user.email || '',
        phone: verifiedPhone,
        fullName: user.displayName || email.split('@')[0] || 'Unique One User',
        uniqueOneId: generatedUniqueOneId(user.uid),
        roles: ['customer'],
        permissions: [],
        status: 'active',
        preferredLanguage: 'en',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        verificationStatus: 'phone_verified',
        hasSecurePin: false,
        twoFactorEnabled: false,
      };
      await setDoc(userDocRef, osUser);
    } else {
      const updates: Record<string, string> = {
        lastLogin: new Date().toISOString(),
      };
      if (user.phoneNumber && existing?.phone !== user.phoneNumber) {
        updates.phone = user.phoneNumber;
        updates.verificationStatus = 'phone_verified';
      }
      await updateDoc(userDocRef, updates);
    }

    navigate(from, { replace: true });
    return true;
  };

  useEffect(() => {
    let active = true;

    const completeLogin = async (user: FirebaseUser) => {
      if (!active || !user || postLoginHandled.current) return;
      postLoginHandled.current = true;
      setLoading(true);
      setError('');
      try {
        await handlePostLogin(user);
      } catch (err: any) {
        postLoginHandled.current = false;
        if (active) {
          console.error('Post-login setup error', err);
          setError(err.message || 'Signed in, but we could not finish opening your account.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) void completeLogin(user);
    });

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          postLoginHandled.current = false;
          void completeLogin(result.user);
        }
      })
      .catch((err: any) => {
        if (!active) return;
        console.error('Google redirect login error', err);
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribeAuth();
      clearRecaptcha();
    };
  }, []);

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalized = normalizePhoneNumber(phone);
    if (!/^\+\d{8,15}$/.test(normalized)) {
      setError('Enter a valid phone number, for example +234 801 234 5678.');
      return;
    }

    setLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, normalized, getRecaptchaVerifier());
      setPhoneConfirmation(confirmation);
      setPhoneStep('code');
      setPhone('');
    } catch (err: any) {
      console.error('Phone login error', err);
      clearRecaptcha();
      setError(err.code === 'auth/invalid-phone-number'
        ? 'Please enter a valid phone number.'
        : err.message || 'We could not send the verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneConfirmation || !/^\d{6}$/.test(phoneCode.trim())) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await phoneConfirmation.confirm(phoneCode.trim());
      setPhoneCode('');
      setPhoneConfirmation(null);
      setPhoneStep('phone');
      clearRecaptcha();
    } catch (err: any) {
      console.error('Phone verification error', err);
      setError(err.code === 'auth/invalid-verification-code'
        ? 'That verification code is not correct.'
        : err.message || 'We could not verify the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state listener completes the account setup and, when needed,
      // opens the required phone verification gate before dashboard access.
    } catch (err: any) {
      console.error('Email Login error', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google login error', err);
      setLoading(false);
      if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        setError('Network request failed. Please open Unique One in a normal browser tab and try again.');
      } else {
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
      }
    }
  };

  const handleGateSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    const normalized = normalizePhoneNumber(gatePhone);
    if (!/^\+\d{8,15}$/.test(normalized)) {
      setError('Enter a valid phone number, for example +234 801 234 5678.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(
        { phoneNumber: normalized },
        getRecaptchaVerifier()
      );
      setGateVerificationId(verificationId);
      setGatePhone(normalized);
      setGateStep('code');
    } catch (err: any) {
      console.error('Phone verification setup error', err);
      clearRecaptcha();
      setError(err.code === 'auth/credential-already-in-use'
        ? 'That phone number is already linked to another Unique One account.'
        : err.message || 'We could not send the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleGateVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser || !gateVerificationId || !/^\d{6}$/.test(gateCode.trim())) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const credential = PhoneAuthProvider.credential(gateVerificationId, gateCode.trim());
      const linked = await linkWithCredential(pendingUser, credential);
      setPhoneGateOpen(false);
      setGateCode('');
      setGateVerificationId('');
      clearRecaptcha();
      postLoginHandled.current = false;
      await handlePostLogin(linked.user);
    } catch (err: any) {
      console.error('Phone linking error', err);
      setError(err.code === 'auth/credential-already-in-use'
        ? 'That phone number is already linked to another Unique One account.'
        : err.code === 'auth/invalid-verification-code'
          ? 'That verification code is not correct.'
          : err.message || 'We could not verify your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const closeGate = () => {
    // Email/Google authentication is intentionally not allowed to enter
    // the protected interface until a phone number is verified.
    setPhoneGateOpen(false);
    setPendingUser(null);
    setGateCode('');
    setGateVerificationId('');
    clearRecaptcha();
    setError('Phone verification is required before opening your Unique One account.');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm font-bold mb-4">
            UNIQUE ID + UNIQUEPAY
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to Unique One</h1>
          <p className="text-slate-500 mt-2">Your phone number is your primary Unique One access.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">Recommended: Continue with phone</p>
              <p className="text-sm text-slate-600 mt-1">
                Verify your phone once. Your Unique ID is automatically associated with your account for UniquePay and Unique Store.
              </p>
            </div>
          </div>
        </div>

        {phoneStep === 'phone' ? (
          <form onSubmit={handlePhoneLogin} className="space-y-4 mb-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 block">Phone number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none"
                  placeholder="+234 801 234 5678"
                  autoComplete="tel"
                  required
                />
              </div>
              <p className="text-xs text-slate-500">You'll receive a one-time verification code.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue with phone <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneCode} className="space-y-4 mb-6">
            <div className="text-center">
              <KeyRound className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <p className="font-semibold text-slate-900">Enter your verification code</p>
              <p className="text-sm text-slate-500 mt-1">We sent a 6-digit code to your phone.</p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-[0.5em] text-xl py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none"
              placeholder="••••••"
              autoComplete="one-time-code"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify and continue'}
            </button>
            <button
              type="button"
              onClick={() => { setPhoneStep('phone'); setPhoneCode(''); setPhoneConfirmation(null); clearRecaptcha(); }}
              className="w-full text-sm font-semibold text-slate-600"
              disabled={loading}
            >
              Use a different phone number
            </button>
          </form>
        )}

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-500">Or use another sign-in method</span></div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm font-semibold text-slate-700 hover:underline">Forgot password?</Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-xl py-3 font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log in with email'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-slate-700 border border-slate-200 rounded-xl py-3 font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-slate-600 mt-6">
          New to Unique One? <Link to="/register" className="font-semibold text-slate-900 hover:underline">Create an account</Link>
        </p>
      </div>

      <div id="recaptcha-container" />

      {phoneGateOpen && pendingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-green-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add your phone number</h2>
                <p className="text-sm text-slate-500">One more step before your Unique One account opens.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-5 text-sm text-slate-600">
              Your phone number becomes your primary Unique One identity and is used to associate your automatically generated Unique ID with UniquePay and Unique Store.
            </div>

            {gateStep === 'phone' ? (
              <form onSubmit={handleGateSendCode} className="space-y-4">
                <input
                  type="tel"
                  value={gatePhone}
                  onChange={(e) => setGatePhone(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none"
                  placeholder="+234 801 234 5678"
                  autoComplete="tel"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send verification code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleGateVerifyCode} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={gateCode}
                  onChange={(e) => setGateCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-xl py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none"
                  placeholder="••••••"
                  autoComplete="one-time-code"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify phone and open Unique One'}
                </button>
                <button
                  type="button"
                  onClick={() => { setGateStep('phone'); setGateCode(''); setGateVerificationId(''); clearRecaptcha(); }}
                  className="w-full text-sm font-semibold text-slate-600"
                  disabled={loading}
                >
                  Use a different phone number
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={closeGate}
              className="w-full mt-4 text-sm font-semibold text-slate-500 hover:text-slate-900"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
