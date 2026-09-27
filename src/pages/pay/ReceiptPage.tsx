import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Receipt, Download, ArrowLeft, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FinancialTransactionViewModel, formatFinancialTransactionAmount, mapFinancialTransaction } from '../../lib/os/pay/financialTransaction';

function formatDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }

export default function ReceiptPage() {
  const { id } = useParams();
  const { currentUser, loading: authLoading } = useAuth();
  const [transaction, setTransaction] = useState<FinancialTransactionViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadReceipt = async () => {
      if (authLoading) return;
      if (!currentUser || !id) { if (mounted) { setError('This receipt is unavailable.'); setLoading(false); } return; }
      setLoading(true); setError('');
      try {
        const snapshot = await getDoc(doc(db, 'transactions', id));
        if (!snapshot.exists()) throw new Error('Transaction not found.');
        const mapped = mapFinancialTransaction(snapshot.id, snapshot.data(), currentUser.uid);
        if (!mapped) throw new Error('This transaction is not a valid financial record.');
        if (mounted) setTransaction(mapped);
      } catch (loadError) {
        console.error('Unable to load receipt:', loadError);
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load this receipt.');
      } finally { if (mounted) setLoading(false); }
    };
    void loadReceipt();
    return () => { mounted = false; };
  }, [authLoading, currentUser, id]);

  if (authLoading || loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (error || !transaction) return <div className="max-w-3xl mx-auto px-4 py-12 text-center"><AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-900 mb-2">{error || 'Receipt unavailable.'}</h2><Link to="/os/pay/history" className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium">Back to History</Link></div>;

  const isOutgoing = transaction.direction === 'outgoing';
  return <div className="max-w-3xl mx-auto space-y-6 pb-12">
    <div className="flex items-center justify-between">
      <Link to="/os/pay/history" className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium transition-colors"><ArrowLeft className="w-4 h-4" /> Back to History</Link>
      <button type="button" onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Print / Save PDF</button>
    </div>
    <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 relative z-10">
        <div className="flex items-center gap-3"><div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center"><Receipt className="w-6 h-6 text-emerald-600" /></div><div><h2 className="text-xl font-bold text-slate-900">Transaction Receipt</h2><p className="text-sm text-slate-500 break-all">Ref: {transaction.reference}</p></div></div>
        <div className="text-left md:text-right"><p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Amount</p><p className="text-3xl font-bold text-slate-900 mt-1">{isOutgoing ? '-' : '+'}{formatFinancialTransactionAmount(transaction)}</p></div>
      </div>
      <div className="py-8 space-y-6 relative z-10">
        {[['Date', formatDate(transaction.createdAt)], ['Status', transaction.status], ['Sender', transaction.senderId], ['Recipient', transaction.recipientId], ['Type', transaction.type.replaceAll('_', ' ')], ['Source', transaction.sourceModule]].map(([label, value]) => <div key={label} className="flex justify-between items-center gap-4 py-3 border-b border-slate-50"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900 text-right break-all capitalize">{value}</span></div>)}
        {transaction.relatedOrderId && <div className="flex justify-between items-center gap-4 py-3 border-b border-slate-50"><span className="text-slate-500">Order</span><span className="font-medium text-slate-900 text-right break-all">{transaction.relatedOrderId}</span></div>}
      </div>
      <div className="mt-8 bg-slate-50 rounded-xl p-4 flex items-center justify-center gap-2 text-sm text-slate-500 relative z-10"><ShieldCheck className="w-4 h-4 text-emerald-500" /> This receipt is generated from the verified UniquePay financial ledger.</div>
    </div>
  </div>;
}
