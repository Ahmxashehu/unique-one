import React from 'react';
import { GraduationCap, FileText, ArrowRight, Users, Plus, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SchoolPaymentDashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">School Payments</h1>
          <p className="text-sm text-slate-500 mt-1">Manage school fees, uniforms, and examination payments securely.</p>
        </div>
        <div className="flex gap-2">
           <button className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
             <Download className="w-4 h-4" /> Export Ledger
           </button>
           <button className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2">
             <Plus className="w-4 h-4" /> Bulk Request
           </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-900">Parents & Students</h3>
          <p className="text-sm text-slate-500 mt-1">Manage linked profiles and send individual or bulk fee requests.</p>
          <button className="mt-4 text-emerald-600 text-sm font-medium hover:underline flex items-center gap-1">
             View Directory <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-900">Pending Requests</h3>
          <p className="text-sm text-slate-500 mt-1">Track sent, viewed, and approved requests across all classes.</p>
          <button className="mt-4 text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1">
             View Requests <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-900">Fee Structures</h3>
          <p className="text-sm text-slate-500 mt-1">Configure tuition, transport, feeding, and exam fee items.</p>
          <button className="mt-4 text-amber-600 text-sm font-medium hover:underline flex items-center gap-1">
             Manage Fees <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center mt-6">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">No active school profiles</h3>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          You haven't linked any students to a verified school organization, or configured any fee structures yet.
        </p>
        <Link to="/os/dashboard" className="inline-block mt-6 px-6 py-3 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
