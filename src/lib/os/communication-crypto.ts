const STORAGE_PREFIX = 'unique-one:e2ee:';
const ALGORITHM = 'ECDH';
const CURVE = 'P-256';

type StoredKey = { privateKey: JsonWebKey; publicKey: JsonWebKey };

function storageKey(uid: string) { return STORAGE_PREFIX + uid; }

function getStorage(uid: string): StoredKey | null {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    return raw ? JSON.parse(raw) as StoredKey : null;
  } catch { return null; }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function ensureDeviceKeyPair(uid: string): Promise<JsonWebKey> {
  const existing = getStorage(uid);
  if (existing?.privateKey && existing.publicKey) return existing.publicKey;
  const pair = await crypto.subtle.generateKey({ name: ALGORITHM, namedCurve: CURVE }, true, ['deriveKey']);
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ]);
  window.localStorage.setItem(storageKey(uid), JSON.stringify({ privateKey, publicKey }));
  return publicKey;
}

async function importPrivate(uid: string): Promise<CryptoKey> {
  const stored = getStorage(uid);
  if (!stored) throw new Error('This device does not have an encryption key for this account.');
  return crypto.subtle.importKey('jwk', stored.privateKey, { name: ALGORITHM, namedCurve: CURVE }, false, ['deriveKey']);
}

async function importPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: ALGORITHM, namedCurve: CURVE }, false, []);
}

async function deriveKey(uid: string, peerPublicKey: JsonWebKey): Promise<CryptoKey> {
  const privateKey = await importPrivate(uid);
  const publicKey = await importPublic(peerPublicKey);
  return crypto.subtle.deriveKey(
    { name: ALGORITHM, public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptForUser(uid: string, peerPublicKey: JsonWebKey, plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const key = await deriveKey(uid, peerPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptFromUser(uid: string, senderPublicKey: JsonWebKey, payload: { iv: string; ciphertext: string }): Promise<string> {
  const key = await deriveKey(uid, senderPublicKey);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.ciphertext));
  return new TextDecoder().decode(plaintext);
}

export async function registerPublicKey(uid: string, token: string, publicKey: JsonWebKey): Promise<void> {
  const response = await fetch('/api/communication/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ publicKey }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to register this device encryption key.');
}

export async function getUserPublicKey(uid: string, token: string): Promise<JsonWebKey | null> {
  if (!uid) return null;
  const response = await fetch(`/api/communication/keys/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to load the recipient encryption key.');
  return payload?.publicKey ?? null;
}

export function isEncryptedMessage(value: unknown): value is { recipientId: string; senderPublicKey: JsonWebKey; iv: string; ciphertext: string } {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.recipientId === 'string' && typeof item.iv === 'string' && typeof item.ciphertext === 'string' && !!item.senderPublicKey;
}
