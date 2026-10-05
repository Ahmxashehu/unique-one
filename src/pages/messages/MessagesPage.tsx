import React from 'react';
import { useLocation } from 'react-router-dom';
import MessagesCenter from './MessagesCenter';
import ChatView from './ChatView';
import NewMessagePage from './NewMessagePage';
import AddUserPage from './AddUserPage';

export default function MessagesPage() {
  const location = useLocation();
  const relativePath = location.pathname.replace(/^\/os\/messages\/?/, '').split('/')[0];
  const isConversation = relativePath.length > 0 && !['add', 'new'].includes(relativePath);

  const content = relativePath === 'add'
    ? <AddUserPage />
    : relativePath === 'new'
      ? <NewMessagePage />
      : isConversation
        ? <ChatView />
        : <MessagesCenter />;

  if (relativePath === 'add' || relativePath === 'new' || isConversation) {
    return (
      <div className="h-full min-h-0 w-full">
        <div className="hidden md:flex h-full min-h-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <aside className="w-96 shrink-0 overflow-hidden border-r border-slate-200 bg-white">
            <MessagesCenter />
          </aside>
          <section className="min-w-0 flex-1 overflow-hidden bg-slate-50">
            {content}
          </section>
        </div>
        <div className="md:hidden h-full min-h-0 overflow-hidden">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <MessagesCenter />
    </div>
  );
}
