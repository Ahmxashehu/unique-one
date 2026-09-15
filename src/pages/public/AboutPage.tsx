import React from 'react';
import { ShieldCheck, Globe, Users } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-16">
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900">
          About Unique One
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          The public ecosystem driving innovation, commerce, and connection across Nigeria, powered by the secure UniqueOS infrastructure.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
            <Globe className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">One Ecosystem</h3>
          <p className="text-slate-600 text-sm leading-relaxed">A unified platform connecting consumers, businesses, and services in a single accessible network.</p>
        </div>
        
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">Secure Core</h3>
          <p className="text-slate-600 text-sm leading-relaxed">UniqueOS provides robust authentication, unified payments, and secure data handling for all ecosystem participants.</p>
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">Community Driven</h3>
          <p className="text-slate-600 text-sm leading-relaxed">Built to empower local commerce, facilitate verified interactions, and grow the digital economy.</p>
        </div>
      </div>
    </div>
  );
}
