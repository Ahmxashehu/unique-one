import React from 'react';
import { FileText, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StoreQuoteRequestPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Quotes & Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Manage custom product requests and seller quotes.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/store/product-request" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
            New Request
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-10 h-10 text-indigo-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">No active quotes</h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">
          You haven't requested any custom products or received quotes yet.
        </p>
      </div>
    </div>
  );
}
