import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash, MessageSquare, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadMedia } from '../lib/media/upload';

export default function ProfilePage() {
  const { userData, currentUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [formData, setFormData] = useState({
    fullName: userData?.fullName || '',
    phone: userData?.phone || '',
    username: userData?.username || '',
    preferredLanguage: userData?.preferredLanguage || 'en',
  });

  if (!userData) {
    return <div className="p-8 text-center text-slate-500">Loading profile...</div>;
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUser) return;
    setPhotoError('');
    setPhotoLoading(true);
    try {
      const result = await uploadMedia(file, {
        ownerId: currentUser.uid,
        pathPrefix: `users/${currentUser.uid}/profile`,
        fileId: 'avatar',
        maxBytes: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        optimizeImage: true,
        imageMaxDimension: 512,
        imageTargetBytes: 180 * 1024,
      });
      await updateDoc(doc(db, 'users', currentUser.uid), { profilePhotoUrl: result.downloadUrl });
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      setPhotoError(err instanceof Error ? err.message : 'Unable to update profile photo.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    setPhotoError('');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        username: formData.username.trim(),
        preferredLanguage: formData.preferredLanguage,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setPhotoError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unified Profile</h1>
          <div className="mt-2 mb-2">
             <Link to="/os/messages" className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors inline-flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4" /> Message User
             </Link>
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage your identity across the Unique One ecosystem.</p>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-slate-100">
          <div className="relative shrink-0">
            <div className="w-24 h-24 bg-indigo-50 rounded-full overflow-hidden flex items-center justify-center text-indigo-700 text-3xl font-bold uppercase">
              {userData.profilePhotoUrl ? <img src={userData.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" /> : userData.fullName.charAt(0)}
            </div>
            <label className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center cursor-pointer shadow-lg">
              {photoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoChange} disabled={photoLoading} className="hidden" />
            </label>
            {photoError && <p className="absolute top-full left-0 mt-2 w-56 text-xs text-red-600">{photoError}</p>}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-slate-900">{userData.fullName}</h2>
              {userData.verificationStatus !== 'unverified' && (
                <ShieldCheck className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <p className="text-slate-500 font-medium mb-3">Unique One ID: <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono text-sm">{userData.uniqueOneId}</span></p>
            <div className="flex flex-wrap gap-2">
              {userData.roles.map(role => (
                <span key={role} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                  {role.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4" /> Full Name
            </label>
            {isEditing ? (
              <input 
                type="text" 
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-none" 
              />
            ) : (
              <p className="text-slate-900 font-medium">{userData.fullName}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Hash className="w-4 h-4" /> Username
            </label>
            {isEditing ? (
              <input 
                type="text" 
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                placeholder="@username"
              />
            ) : (
              <p className="text-slate-900 font-medium">{userData.username || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email Address
            </label>
            <p className="text-slate-900 font-medium">{userData.email}</p>
            {isEditing && <p className="text-xs text-slate-400 mt-1">Email cannot be changed directly.</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Phone Number
            </label>
            {isEditing ? (
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                placeholder="+234..."
              />
            ) : (
              <p className="text-slate-900 font-medium">{userData.phone || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </label>
            <p className="text-slate-900 font-medium">{userData.location?.address || <span className="text-slate-400 italic">No location set</span>}</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" /> Account Status
            </label>
            <p className="text-slate-900 font-medium capitalize">{userData.status}</p>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Last Login
            </label>
            <p className="text-slate-900 font-medium">{new Date(userData.lastLogin).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
