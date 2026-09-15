import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export default function NewMessagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function initConversation() {
      if (!currentUser) return;
      
      try {
        const orderId = searchParams.get('order');
        const paymentId = searchParams.get('payment');
        const invoiceId = searchParams.get('invoice');
        const productId = searchParams.get('product');
        const sellerId = searchParams.get('seller');
        const customerId = searchParams.get('customer');
        const supplierId = searchParams.get('supplier');
        const staffId = searchParams.get('staff');

        let targetId = sellerId || customerId || supplierId || staffId || 'unknown';
        if (targetId === 'unknown' && orderId) targetId = 'order_seller'; // Simplified for demo
        
        // Very basic query for existing conversation
        let q;
        if (orderId) {
           q = query(collection(db, 'conversations'), where('orderId', '==', orderId), where('participants', 'array-contains', currentUser.uid));
        } else if (productId) {
           q = query(collection(db, 'conversations'), where('productId', '==', productId), where('participants', 'array-contains', currentUser.uid));
        } else {
           // Direct chat check
           q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid), where('type', '==', 'direct'));
        }

        const querySnapshot = await getDocs(q);
        
        let existingConv = null;
        if (!querySnapshot.empty) {
            // Find an exact match if it's a direct chat (checking both participants)
            if (targetId && !orderId && !productId) {
               existingConv = querySnapshot.docs.find(doc => (doc.data() as any).participants.includes(targetId));
            } else {
               existingConv = querySnapshot.docs[0];
            }
        }

        if (existingConv) {
          navigate(`/os/messages/${existingConv.id}`, { replace: true });
        } else {
          // Create new
          const newConv = {
            type: (orderId || paymentId || invoiceId || productId) ? 'business' : 'direct',
            participants: [currentUser.uid, targetId],
            title: targetId, // Would normally lookup user name
            unreadCounts: { [targetId]: 0, [currentUser.uid]: 0 },
            orderId: orderId || null,
            paymentRequestId: paymentId || null,
            invoiceId: invoiceId || null,
            productId: productId || null,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const docRef = await addDoc(collection(db, 'conversations'), newConv);
          navigate(`/os/messages/${docRef.id}`, { replace: true });
        }
      } catch (err) {
        console.error(err);
        setError('Failed to start conversation');
      }
    }

    initConversation();
  }, [currentUser, searchParams, navigate]);

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8 bg-slate-50 md:rounded-3xl items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4 relative overflow-hidden">
          <MessageSquare className="w-8 h-8 text-slate-300 relative z-10" />
          {!error && <div className="absolute inset-0 bg-slate-100 animate-pulse"></div>}
        </div>
        {error ? (
           <h3 className="text-lg font-semibold text-red-600">{error}</h3>
        ) : (
           <>
             <h3 className="text-lg font-semibold text-slate-900 flex items-center justify-center gap-2">
               <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> Starting conversation...
             </h3>
             <p className="text-slate-500 text-sm mt-1">Establishing context and securing channel</p>
           </>
        )}
      </div>
    </div>
  );
}
