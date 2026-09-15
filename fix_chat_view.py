import re

with open('src/pages/messages/ChatView.tsx', 'r') as f:
    content = f.read()

replacement = """import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, Video, MoreVertical, Paperclip, Send, 
  ShoppingBag, CreditCard, FileText, Store, Info, 
  Check, CheckCheck, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineQueue } from '../../contexts/OfflineQueueContext';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Conversation, Message } from '../../lib/os/types';

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { enqueueOperation, isOnline } = useOfflineQueue();
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  
  useEffect(() => {
    if (!id) return;
    
    // Fetch conversation details
    const convRef = doc(db, 'conversations', id);
    const unsubConv = onSnapshot(convRef, (docSnap) => {
      if (docSnap.exists()) {
        setConversation({ id: docSnap.id, ...docSnap.data() } as Conversation);
      }
    });

    // Fetch messages
    const q = query(
      collection(db, 'conversations', id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubMsgs = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });

    return () => {
      unsubConv();
      unsubMsgs();
    };
  }, [id]);

  const handleSend = () => {
    if (!message.trim() || !id || !currentUser) return;
    
    const newMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const msgData: Message = {
      id: newMsgId,
      conversationId: id,
      senderId: currentUser.uid,
      text: message.trim(),
      status: 'queued',
      createdAt: new Date().toISOString()
    };
    
    // Optimistic update
    setMessages(prev => [...prev, msgData]);
    setMessage('');
    
    // Queue send
    enqueueOperation(`Send Message`, async () => {
      msgData.status = 'sent';
      const msgRef = doc(db, 'conversations', id, 'messages', newMsgId);
      await setDoc(msgRef, msgData);
      
      const convRef = doc(db, 'conversations', id);
      await updateDoc(convRef, {
        lastMessage: msgData.text,
        lastMessageAt: msgData.createdAt,
        lastMessageSenderId: currentUser.uid,
        updatedAt: new Date().toISOString()
      });
    });
  };

  const renderContextBanner = () => {
    if (!conversation) return null;
    let type = '';
    let title = '';
    
    if (conversation.orderId) { type = 'order'; title = `Order ${conversation.orderId}`; }
    else if (conversation.paymentRequestId) { type = 'payment'; title = `Payment Request ${conversation.paymentRequestId}`; }
    else if (conversation.invoiceId) { type = 'invoice'; title = `Invoice ${conversation.invoiceId}`; }
    else if (conversation.productId) { type = 'store'; title = 'Store Product'; }
    else return null;

    const icons = { order: ShoppingBag, payment: CreditCard, invoice: FileText, store: Store };
    const Icon = icons[type as keyof typeof icons] || Info;

    return (
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500 capitalize">{type}</p>
          </div>
        </div>
        <button className="text-sm font-medium text-slate-900 border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">
          View
        </button>
      </div>
    );
  };
"""

# replace up to `return (`
idx = content.find("  return (")
if idx != -1:
    content = replacement + "\n" + content[idx:]
    with open('src/pages/messages/ChatView.tsx', 'w') as f:
        f.write(content)
