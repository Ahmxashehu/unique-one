const fs = require('fs');

// Fix NewMessagePage
let newMsgCode = fs.readFileSync('src/pages/messages/NewMessagePage.tsx', 'utf8');
newMsgCode = newMsgCode.replace('existingConv = querySnapshot.docs.find(doc => doc.data().participants.includes(targetId));', 'existingConv = querySnapshot.docs.find(doc => (doc.data() as any).participants.includes(targetId));');
fs.writeFileSync('src/pages/messages/NewMessagePage.tsx', newMsgCode);

// Fix StoreProductRequestPage
let requestCode = fs.readFileSync('src/pages/store/StoreProductRequestPage.tsx', 'utf8');
if (!requestCode.includes("import { db } from '../../lib/firebase';")) {
  requestCode = requestCode.replace("import { PackageSearch, Send, Loader2 } from 'lucide-react';", "import { PackageSearch, Send, Loader2 } from 'lucide-react';\nimport { db } from '../../lib/firebase';\nimport { doc, collection, setDoc } from 'firebase/firestore';");
}
fs.writeFileSync('src/pages/store/StoreProductRequestPage.tsx', requestCode);
