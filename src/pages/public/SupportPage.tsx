import React from 'react';
import { HelpCircle, Mail, MessageSquare } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">Help & Support</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          We're here to help you navigate the Unique One ecosystem.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600 mb-4">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">Knowledge Base</h3>
          <p className="text-slate-500 mt-2 text-sm">Read guides and FAQs about using UniqueOS.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">Contact Support</h3>
          <p className="text-slate-500 mt-2 text-sm">Send us a message and our team will respond shortly.</p>
        </div>
      </div>
    </div>
  );
}
