import React, { useState } from 'react';
import { Building2, ArrowRight, Loader2, Upload, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function BusinessRegisterPage() {
  const { currentUser, userData, hasRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    registrationNumber: '',
    description: '',
    contactEmail: userData?.email || '',
    contactPhone: userData?.phone || '',
    category: 'retail'
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) return;
    
    setLoading(true);
    setError('');
    
    try {
      // 1. Create Business Document
      const businessRef = await addDoc(collection(db, 'businesses'), {
        ownerUid: currentUser.uid,
        name: formData.name,
        registrationNumber: formData.registrationNumber,
        description: formData.description,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        categories: [formData.category],
        status: 'pending',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString()
      });

      // 2. Update User Document Roles
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        roles: arrayUnion('business_owner')
      });

      navigate('/os/business/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Failed to submit business registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (hasRole('business_owner')) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-8 text-center">
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">You already have a business account</h2>
          <p className="text-slate-600 mb-4">Go to your Seller Dashboard to manage your business and branches.</p>
          <button 
            onClick={() => navigate('/os/business/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Register Your Business</h1>
        <p className="text-slate-500 mt-2">Join the Unique One ecosystem and reach more customers.</p>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" 
                placeholder="Acme Corp" 
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number (CAC/RC)</label>
              <input 
                type="text" 
                value={formData.registrationNumber}
                onChange={e => setFormData({...formData, registrationNumber: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" 
                placeholder="RC-123456 (Optional for now)" 
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Email</label>
              <input 
                type="email" 
                required
                value={formData.contactEmail}
                onChange={e => setFormData({...formData, contactEmail: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" 
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Phone</label>
              <input 
                type="tel" 
                required
                value={formData.contactPhone}
                onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" 
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Primary Category</label>
            <select 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              disabled={loading}
            >
              <option value="retail">Retail & E-commerce</option>
              <option value="agriculture">Agriculture & Farming</option>
              <option value="logistics">Logistics & Delivery</option>
              <option value="services">Professional Services</option>
              <option value="healthcare">Healthcare</option>
              <option value="real_estate">Real Estate & Property</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Business Description</label>
            <textarea 
              required
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 h-32" 
              placeholder="Tell us what your business does..."
              disabled={loading}
            ></textarea>
          </div>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl border-dashed">
             <div className="flex items-center gap-3 text-slate-600 mb-2">
               <Upload className="w-5 h-5" />
               <span className="font-medium">Verification Documents</span>
             </div>
             <p className="text-sm text-slate-500 mb-3">You can upload your CAC certificate and utility bills later from the business settings dashboard.</p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Submit Application <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
