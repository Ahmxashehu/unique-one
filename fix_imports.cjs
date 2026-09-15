const fs = require('fs');
let code = fs.readFileSync('src/pages/store/StoreProductRequestPage.tsx', 'utf8');

code = "import { db } from '../../lib/firebase';\nimport { doc, collection, setDoc } from 'firebase/firestore';\n" + code;

fs.writeFileSync('src/pages/store/StoreProductRequestPage.tsx', code);
