import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  try {
    console.log("Registering test user...");
    const cred = await createUserWithEmailAndPassword(auth, 'test@example.com', 'password123');
    console.log("Auth success!", cred.user.uid);
    
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email,
      fullName: 'Test User',
      uniqueOneId: 'U1-123456',
      roles: ['customer']
    });
    console.log("Firestore success!");
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
