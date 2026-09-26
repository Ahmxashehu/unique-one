import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function NewMessagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function initConversation() {
      if (!currentUser) return;
      try {
        const targetId = searchParams.get('user') || searchParams.get('seller') || searchParams.get('customer') || searchParams.get('supplier') || searchParams.get('staff');
        if (!targetId) {
          throw new Error('Choose a recipient before starting a conversation.');
        }
        if (targetId === currentUser.uid) {
          throw new Error('You cannot start a conversation with yourself.');
        }

        const token = await currentUser.getIdToken();
        const response = await fetch('/api/communication/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'direct',
            memberUids: [targetId],
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? 'Failed to start conversation.');
        }
        if (!cancelled && payload?.conversation?.id) {
          navigate(`/os/messages/${payload.conversation.id}`, { replace: true });
        } else if (!cancelled) {
          throw new Error('Conversation was created without an ID.');
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to start conversation.');
      }
    }
    void initConversation();
    return () => { cancelled = true; };
  }, [currentUser, searchParams, navigate]);

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8 bg-slate-50 md:rounded-3xl items-center justify-center">
      <div className="text-center px-6">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-slate-300" />
        </div>
        {error ? (
          <>
            <h3 className="text-lg font-semibold text-red-600">{error}</h3>
            <button onClick={() => navigate('/os/messages')} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm">Back to Messages</button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> Starting conversation...
            </h3>
            <p className="text-slate-500 text-sm mt-1">Securing the communication channel</p>
          </>
        )}
      </div>
    </div>
  );
}
