import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, ShieldCheck, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="pt-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            UniqueOS is now live in Nigeria 🇳🇬
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
            The ecosystem for the future.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            UNIQUE ONE 🇳🇬 is the public ecosystem. UniqueOS is the internal shared operating system powering accounts, messaging, payments, and bookings.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/os" className="bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
              Enter UniqueOS <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50 border-t border-slate-100" id="ecosystem">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Public Ecosystem</h3>
              <p className="text-slate-600 leading-relaxed">
                Connect with the Unique One public network, accessible via web and mobile across all regions.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Secure UniqueOS</h3>
              <p className="text-slate-600 leading-relaxed">
                Unified account management, permissions, and identity verification powered by our internal OS.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Integrated Services</h3>
              <p className="text-slate-600 leading-relaxed">
                Unique Store, UniquePay, Bookings, and Search seamlessly integrated into one platform.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
