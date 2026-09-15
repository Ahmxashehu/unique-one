import re

with open('src/pages/store/StoreProductRequestPage.tsx', 'r') as f:
    content = f.read()

old_func = """  const handleSubmit = (e: React.FormEvent, status: 'draft' | 'published') => {
    e.preventDefault();
    if (!title || !description) return;
    
    setLoading(true);
    enqueueOperation(`Save Product Request: ${title}`, async () => {
       await new Promise(r => setTimeout(r, 800)); // Simulate write
    });
    
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1000);
  };"""

new_func = """  const handleSubmit = (e: React.FormEvent, status: 'draft' | 'published') => {
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
  };"""

content = content.replace(old_func, new_func)

if 'import { doc, collection, setDoc } from \'firebase/firestore\';' not in content:
    content = content.replace("import { db } from '../../lib/firebase';", "import { db } from '../../lib/firebase';\nimport { doc, collection, setDoc } from 'firebase/firestore';")

with open('src/pages/store/StoreProductRequestPage.tsx', 'w') as f:
    f.write(content)
