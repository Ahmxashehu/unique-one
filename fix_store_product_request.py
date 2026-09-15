import re

with open('src/pages/store/StoreProductRequestPage.tsx', 'r') as f:
    content = f.read()

replacement = """
  const handleSubmit = (e: React.FormEvent, status: 'draft' | 'published') => {
    e.preventDefault();
    if (!title || !description || !currentUser) return;
    
    setLoading(true);
    enqueueOperation(`Save Product Request: ${title}`, async () => {
       const requestId = doc(collection(db, 'productRequests')).id;
       const requestData = {
         id: requestId,
         customerId: currentUser.uid,
         title,
         description,
         quantity: quantity ? parseInt(quantity) : 1,
         budget: budget ? parseFloat(budget) : 0,
         location: '',
         requiredDate: '',
         isPublic: true,
         expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
         status,
         createdAt: new Date().toISOString()
       };
       await setDoc(doc(db, 'productRequests', requestId), requestData);
    });
    
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1000);
  };
"""

content = re.sub(r'  const handleSubmit = \(e: React\.FormEvent, status: \'draft\' \| \'published\'\) => \{[^}]+\n    \}, 1000\);\n  \};', replacement.strip(), content, flags=re.MULTILINE)

if 'import { doc, collection, setDoc } from \'firebase/firestore\';' not in content:
    content = content.replace("import { db } from '../../lib/firebase';", "import { db } from '../../lib/firebase';\nimport { doc, collection, setDoc } from 'firebase/firestore';")

with open('src/pages/store/StoreProductRequestPage.tsx', 'w') as f:
    f.write(content)
