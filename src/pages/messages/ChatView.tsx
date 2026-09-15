import React, { useState, useEffect } from 'react';
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8 bg-slate-50 md:rounded-3xl md:h-[calc(100vh-100px)] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/os/messages')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full md:hidden">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
              {conversation?.title?.charAt(0) || 'U'}
            </div>
          </div>
          
          <div>
            <h2 className="font-bold text-slate-900 text-sm md:text-base leading-tight">{conversation?.title || 'Loading...'}</h2>
            <p className="text-xs text-slate-500">Active</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors hidden sm:block">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors hidden sm:block">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {renderContextBanner()}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center my-4">
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">Today</span>
        </div>
        
        {messages.map((msg) => {
          if (msg.isSystemMessage) {
            return (
              <div key={msg.id} className="text-center my-4">
                <span className="text-xs text-slate-500 bg-slate-200/50 px-3 py-1 rounded-full">{msg.text}</span>
              </div>
            );
          }

          const isMine = msg.senderId === currentUser?.uid;
          
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2 ${isMine ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm'}`}>
                <p className="text-sm">{msg.text}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMine ? 'text-slate-400' : 'text-slate-400'}`}>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMine && (
                    <>
                      {msg.status === 'queued' && <Clock className="w-3 h-3" />}
                      {msg.status === 'sent' && <Check className="w-3 h-3" />}
                      {msg.status === 'delivered' && <CheckCheck className="w-3 h-3" />}
                      {msg.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-400" />}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0">
        {!isOnline && (
          <div className="mb-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center justify-center gap-2 font-medium">
            <Clock className="w-3 h-3" /> Waiting for connection
          </div>
        )}
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-2">
          <button className="p-3 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none py-3 focus:ring-0 resize-none max-h-32 text-sm focus:outline-none"
            rows={1}
            style={{ minHeight: '44px' }}
          />
          
          <button 
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 shrink-0 mb-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
