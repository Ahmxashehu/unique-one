import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';

const CONFIRMATION = 'UNIQUE_ONE_CREATE_SUPER_ADMIN';
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const suppliedPassword = process.env.SUPER_ADMIN_PASSWORD;
const confirmation = process.env.BOOTSTRAP_SUPER_ADMIN_CONFIRM;
if (confirmation !== CONFIRMATION) throw new Error('Refusing to bootstrap Super Admin: set BOOTSTRAP_SUPER_ADMIN_CONFIRM=UNIQUE_ONE_CREATE_SUPER_ADMIN.');
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('SUPER_ADMIN_EMAIL must be a valid email address.');
if (suppliedPassword && suppliedPassword.length < 12) throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters when supplied.');
function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return applicationDefault();
  const parsed = JSON.parse(raw);
  if (typeof parsed.project_id !== 'string' || typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields.');
  return cert({ projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key });
}
if (getApps().length === 0) initializeApp({ credential: credential(), projectId: 'unique-one-9731b', storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'unique-one-9731b.firebasestorage.app' });
const auth = getAuth();
const db = getFirestore();
const existingSuperAdmin = await db.collection('users').where('roles', 'array-contains', 'super_admin').limit(1).get();
if (!existingSuperAdmin.empty) throw new Error('A Super Admin already exists. Bootstrap is one-time and will not replace or add another Super Admin.');
let user; let created = false;
try { user = await auth.getUserByEmail(email); } catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error;
  const password = suppliedPassword || randomBytes(18).toString('base64url') + 'A7!';
  user = await auth.createUser({ email, password, emailVerified: true, disabled: false });
  created = true;
  console.log('GENERATED_SUPER_ADMIN_PASSWORD=' + password);
}
const now = Timestamp.now();
await db.collection('users').doc(user.uid).set({ uid: user.uid, email, roles: ['super_admin'], permissions: [], status: 'active', adminProvisionedAt: now, adminProvisioningMethod: 'one_time_bootstrap_script', updatedAt: now }, { merge: true });
await db.collection('audit_logs').add({ uid: user.uid, actorUid: user.uid, action: 'super_admin.bootstrap', resource: 'user', resourceId: user.uid, details: JSON.stringify({ email, created }), timestamp: now, createdAt: now });
console.log(JSON.stringify({ success: true, uid: user.uid, email, created, message: 'Super Admin role provisioned. Remove bootstrap environment variables after this run.' }, null, 2));