import React, { useState } from 'react';
import { FileText, Save, Send, Plus, Trash2, Loader2 } from 'lucide-react';
import { useOfflineQueue } from '../../contexts/OfflineQueueContext';
import { useNavigate } from 'react-router-dom';

export default function CreateInvoicePage() {
  const { enqueueOperation } = useOfflineQueue();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState('');
  
  const [items, setItems] = useState([{ desc: '', qty: 1, price: 0 }]);

  const subtotal = items.reduce((acc, item) => acc + (item.qty * item.price), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    enqueueOperation(`Save Invoice for ${customer || 'Customer'}`, async () => {
       await new Promise(r => setTimeout(r, 800));
    });
    setTimeout(() => {
      setLoading(false);
      navigate('/os/invoices');
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">Generate a professional invoice and send it to your customer.</p>
      </div>

      <form className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-8" onSubmit={handleSubmit}>
        
        {/* Header info */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name / Email *</label>
            <input type="text" value={customer} onChange={e=>setCustomer(e.target.value)} required placeholder="Who is this for?" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
              <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Invoice Items</h3>
          
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-wrap md:flex-nowrap items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-[200px]">
                  <input type="text" placeholder="Item description" value={item.desc} onChange={e => {
                    const newItems = [...items]; newItems[idx].desc = e.target.value; setItems(newItems);
                  }} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none" />
                </div>
                <div className="w-24">
                  <input type="number" min="1" placeholder="Qty" value={item.qty} onChange={e => {
                    const newItems = [...items]; newItems[idx].qty = parseInt(e.target.value)||0; setItems(newItems);
                  }} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none" />
                </div>
                <div className="w-32">
                  <input type="number" min="0" step="0.01" placeholder="Price" value={item.price} onChange={e => {
                    const newItems = [...items]; newItems[idx].price = parseFloat(e.target.value)||0; setItems(newItems);
                  }} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none" />
                </div>
                <div className="w-24 text-right pt-2 font-medium text-slate-900">
                  ₦{(item.qty * item.price).toLocaleString()}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button type="button" onClick={() => setItems([...items, { desc: '', qty: 1, price: 0 }])} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-slate-100 pt-6 flex flex-col items-end space-y-3 text-sm">
          <div className="flex justify-between w-64 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-medium text-slate-900">₦{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-64 text-slate-600">
            <span>Tax (0%):</span>
            <span className="font-medium text-slate-900">₦0.00</span>
          </div>
          <div className="flex justify-between w-64 text-slate-900 text-lg font-bold pt-3 border-t border-slate-100">
            <span>Total:</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <button type="button" onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
             Save as Draft
          </button>
          <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Invoice
          </button>
        </div>
      </form>
    </div>
  );
}
