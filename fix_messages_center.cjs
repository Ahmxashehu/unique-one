const fs = require('fs');
let code = fs.readFileSync('src/pages/messages/MessagesCenter.tsx', 'utf8');

const replacement = `
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
`;

code = code.replace(/import React, { useState } from 'react';\nimport { Search, Plus, MessageSquare, Phone, MoreVertical, Store, FileText, ShoppingBag, CreditCard } from 'lucide-react';\nimport { Link, useNavigate } from 'react-router-dom';\n\nexport default function MessagesCenter\(\) \{\n  const navigate = useNavigate\(\);\n  const \[activeTab, setActiveTab\] = useState<'all' | 'business' | 'support'>\('all'\);\n\n  \/\/ Dummy data for now, real implementation will pull from Firestore using offline queue\n  const conversations = \[[^]*\];/g, replacement);


fs.writeFileSync('src/pages/messages/MessagesCenter.tsx', code);
