import React, { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, Phone, MoreVertical, Store, FileText, ShoppingBag, CreditCard, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Conversation } from '../../lib/os/types';

export default function MessagesCenter() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'business' | 'support'>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch conversations where current user is a participant
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      // Sort by lastMessageAt descending
      convs.sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
      setConversations(convs);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [currentUser]);

  // For demonstration, keep empty state if no real data


  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8 bg-white md:bg-transparent">
      {/* Sidebar / List */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-200 bg-white md:rounded-l-3xl md:h-[calc(100vh-100px)]">
        <div className="p-4 border-b border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-900">Messages</h1>
            <button className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
              <Plus className="w-5 h-5 text-slate-700" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search messages..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex border-b border-slate-100 px-2 pt-2">
          {['all', 'business', 'support'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.filter(c => activeTab === 'all' || c.type === activeTab).map(conv => (
            <div 
              key={conv.id}
              onClick={() => navigate(`/os/messages/${conv.id}`)}
              className="flex items-start gap-3 p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors relative"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500">
                  {conv.title.charAt(0)}
                </div>
                {conv.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-slate-900 truncate">{conv.title}</h4>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{conv.lastMessageAt}</span>
                </div>
                <p className="text-sm text-slate-600 truncate mt-0.5">{conv.lastMessage}</p>
                
                {conv.relatedContext && (
                  <div className="flex items-center gap-1 mt-1 text-xs font-medium text-slate-500">
                    {conv.relatedContext.type === 'order' && <ShoppingBag className="w-3 h-3" />}
                    {conv.relatedContext.type === 'payment' && <CreditCard className="w-3 h-3" />}
                    {conv.relatedContext.type === 'invoice' && <FileText className="w-3 h-3" />}
                    {conv.relatedContext.type === 'store' && <Store className="w-3 h-3" />}
                    <span className="capitalize">{conv.relatedContext.type}</span>
                  </div>
                )}
              </div>
              
              {conv.unread > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-900 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {conv.unread}
                </div>
              )}
            </div>
          ))}
          
          {conversations.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area - Hidden on mobile unless active, visible on desktop */}
      <div className="hidden md:flex flex-1 flex-col bg-slate-50 md:rounded-r-3xl md:h-[calc(100vh-100px)] items-center justify-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
          <MessageSquare className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Your Messages</h3>
        <p className="text-slate-500 text-sm mt-1">Select a conversation to start messaging</p>
      </div>
    </div>
  );
}
