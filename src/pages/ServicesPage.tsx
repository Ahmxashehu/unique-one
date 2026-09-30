import React, { useEffect, useState } from 'react';
import { Briefcase, Clock, Loader2, Plus, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

type Service = {
  id: string;
  ownerUid?: string;
  providerName?: string;
  title?: string;
  category?: string;
  description?: string;
  price?: number;
  currency?: string;
  durationHours?: number;
  status?: 'draft' | 'published';
};

export default function ServicesPage() {
  const { currentUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setServices([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'services'), where('ownerUid', '==', currentUser.uid));
    return onSnapshot(q, snapshot => {
      setServices(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Service, 'id'>) })).sort((a,b) => String(b.id).localeCompare(String(a.id))));
      setLoading(false);
    }, err => {
      console.error('Services could not load:', err);
      setError(err instanceof Error ? err.message : 'Could not load services.');
      setLoading(false);
    });
  }, [currentUser]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your live service offerings and catalog.</p>
        </div>
        <Link to="/os/business/catalog/new-service" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />Add Service</Link>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : services.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">No services yet</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">Create your first real service and publish it to Discover and Active Edge.</p>
          <Link to="/os/business/catalog/new-service" className="inline-flex mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Create service</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map(service => (
            <article key={service.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">{service.category || 'Service'}</p><h3 className="mt-1 font-bold text-slate-900">{service.title}</h3></div>
                <span className="text-xs rounded-full px-2 py-1 bg-slate-100 text-slate-600">{service.status || 'draft'}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500 line-clamp-3">{service.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">{service.currency === 'NGN' ? '₦' : '$'}{Number(service.price || 0).toLocaleString()}</span>
                <span className="flex items-center gap-1 text-slate-500"><Clock className="w-4 h-4" />{service.durationHours}h</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
