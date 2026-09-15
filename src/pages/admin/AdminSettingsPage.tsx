import React from 'react';
import { Settings, Save } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure global OS parameters and integrations.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Gateways</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
              <div>
                <p className="font-medium text-slate-900">Paystack Integration</p>
                <p className="text-sm text-slate-500">Live API Key configuration</p>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">Not Configured</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Ecosystem Fees</h3>
          <div className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Standard Transaction Fee (%)</label>
              <input type="number" defaultValue={1.5} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 flex justify-end">
          <button className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
