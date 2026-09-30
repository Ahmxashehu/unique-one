import React, { useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const toB64url = (value: ArrayBuffer | Uint8Array) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const fromB64url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export type BiometricAssertion = {
  challengeId: string;
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
};

export async function createBiometricAssertion(currentUser: any): Promise<BiometricAssertion> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('Biometric/passkey security is not available on this device or browser.');
  }

  const token = await currentUser.getIdToken();
  const start = await fetch('/api/auth/passkey/assertion-options', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const options = await start.json().catch(() => null);

  if (!start.ok) {
    throw new Error(options?.error?.message || 'Unable to start biometric verification.');
  }

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: fromB64url(options.challenge),
      rpId: options.rpId,
      allowCredentials: options.allowCredentials.map((item: { id: string }) => ({
        type: 'public-key',
        id: fromB64url(item.id),
      })),
      userVerification: 'required',
      timeout: options.timeout,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Biometric verification was cancelled.');
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    challengeId: options.challengeId,
    credentialId: toB64url(credential.rawId),
    clientDataJSON: toB64url(response.clientDataJSON),
    authenticatorData: toB64url(response.authenticatorData),
    signature: toB64url(response.signature),
  };
}

export default function PasskeySecurityCard() {
  const { currentUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const register = async () => {
    if (!currentUser) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!window.PublicKeyCredential || !navigator.credentials) {
        throw new Error('Biometric/passkey security is not available on this device or browser.');
      }

      const token = await currentUser.getIdToken();
      const start = await fetch('/api/auth/passkey/registration-options', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      const options = await start.json().catch(() => null);

      if (!start.ok) {
        throw new Error(options?.error?.message || 'Unable to start biometric setup.');
      }

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: fromB64url(options.challenge),
          rp: options.rp,
          user: {
            id: fromB64url(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          authenticatorSelection: options.authenticatorSelection,
          timeout: options.timeout,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Biometric setup was cancelled.');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey();
      const authenticatorData = response.getAuthenticatorData();

      if (!publicKey || !authenticatorData) {
        throw new Error(
          'This browser did not expose the credential public key. Please update the browser and try again.',
        );
      }

      const finish = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          challengeId: options.challengeId,
          credentialId: toB64url(credential.rawId),
          clientDataJSON: toB64url(response.clientDataJSON),
          authenticatorData: toB64url(authenticatorData),
          publicKey: toB64url(publicKey),
        }),
      });

      const result = await finish.json().catch(() => null);

      if (!finish.ok) {
        throw new Error(result?.error?.message || 'Biometric setup could not be completed.');
      }

      setMessage('Biometric/passkey security is now enabled on this device.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric setup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-slate-950 p-3 text-emerald-300">
          <Fingerprint className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">Biometric / passkey authorization</h3>
          <p className="mt-1 text-sm text-slate-600">
            Use your device's fingerprint, face, or screen lock through WebAuthn. Unique One stores
            the public key, never your biometric data.
          </p>

          <button
            onClick={() => void register()}
            disabled={busy || !currentUser}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {busy ? 'Setting up…' : 'Enable biometric security'}
          </button>

          {message && <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
          {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
