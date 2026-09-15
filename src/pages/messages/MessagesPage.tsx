import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import MessagesCenter from './MessagesCenter';
import ChatView from './ChatView';
import NewMessagePage from './NewMessagePage';


export default function MessagesPage() {
  const location = useLocation();
  const isRoot = location.pathname === '/os/messages';
  
  return (
    <div className="h-full">
      <div className="hidden md:block h-full">
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/new" element={
            <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8">
              <div className="w-80 lg:w-96 shrink-0 z-10 relative bg-white border-r border-slate-200">
                <MessagesCenter />
              </div>
              <div className="flex-1 min-w-0 bg-slate-50 relative z-20 p-4 md:p-6 lg:p-8 h-full">
                <NewMessagePage />
              </div>
            </div>
          } />
          <Route path="/:id" element={
            <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8">
              <div className="w-80 lg:w-96 shrink-0 z-10 relative bg-white">
                <MessagesCenter />
              </div>
              <div className="flex-1 min-w-0 bg-slate-50 relative z-20">
                <div className="p-4 md:p-6 lg:p-8 h-full">
                  <ChatView />
                </div>
              </div>
            </div>
          } />
        </Routes>
      </div>
      
      <div className="md:hidden h-full">
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/new" element={<NewMessagePage />} />
          <Route path="/:id" element={<ChatView />} />
        </Routes>
      </div>
    </div>
  );
}
