import React, { useState } from 'react';

type ShippingAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  country: string;
  state: string;
  lga: string;
  town: string;
  area: string;
  fullAddress: string;
  landmark?: string;
  isDefault: boolean;
};
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
  const [emailDraft, setEmailDraft] = useState(userData?.email || '');
  const [emailCode, setEmailCode] = useState('');
  const [emailRemaining, setEmailRemaining] = useState(0);
  const [emailResendRemaining, setEmailResendRemaining] = useState(0);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const defaultShipping = userData?.shippingAddresses?.find(address => address.isDefault) || userData?.shippingAddresses?.[0];
  React.useEffect(() => {
    setEmailDraft(userData?.email || '');
  }, [userData?.email]);
  const [formData, setFormData] = useState({
    firstName: userData?.firstName || '',
    otherName: userData?.otherName || '',
    lastName: userData?.lastName || '',
    fullName: userData?.fullName || '',
    phone: userData?.phone || '',
    username: userData?.username || '',
    preferredLanguage: userData?.preferredLanguage || 'en',
    shippingLabel: defaultShipping?.label || 'Home',
    shippingRecipientName: defaultShipping?.recipientName || userData?.fullName || '',
    shippingPhone: defaultShipping?.phone || userData?.phone || '',
    shippingState: defaultShipping?.state || '',
    shippingLga: defaultShipping?.lga || '',
    shippingTown: defaultShipping?.town || '',
    shippingArea: defaultShipping?.area || '',
    shippingFullAddress: defaultShipping?.fullAddress || '',
    shippingLandmark: defaultShipping?.landmark || '',
    communicationLocationVisibility: userData?.communicationProfile?.locationVisibility || 'city_only',
  });
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(() =>
    (userData?.shippingAddresses || []).map(address => ({ ...address })) as ShippingAddress[]
  );

  React.useEffect(() => {
    setShippingAddresses((userData?.shippingAddresses || []).map(address => ({ ...address })) as ShippingAddress[]);
    setFormData(current => ({
      ...current,
      firstName: userData?.firstName || '',
      otherName: userData?.otherName || '',
      lastName: userData?.lastName || '',
      fullName: userData?.fullName || '',
      username: userData?.username || '',
      preferredLanguage: userData?.preferredLanguage || 'en',
      communicationLocationVisibility: userData?.communicationProfile?.locationVisibility || 'city_only',
    }));
  }, [userData?.uid]);

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

  const requestEmailVerification = async () => {
    if (!currentUser) return;
    const email = emailDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    setEmailMessage('');
    setEmailLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/auth/unique-otp/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to send email verification.');
      setEmailRemaining(body.expiresInSeconds || 300);
      setEmailResendRemaining(body.resendAfterSeconds || 30);
      setEmailCode('');
      setEmailMessage('UniqueOTP sent to your email address.');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Unable to send email verification.');
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyEmail = async () => {
    if (!currentUser) return;
    const email = emailDraft.trim().toLowerCase();
    if (emailRemaining <= 0) {
      setEmailError('This email verification code has expired. Request a new UniqueOTP.');
      return;
    }
    if (!/^\d{6}$/.test(emailCode)) {
      setEmailError('Enter the 6-digit UniqueOTP.');
      return;
    }
    setEmailError('');
    setEmailMessage('');
    setEmailLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/auth/unique-otp/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ email, code: emailCode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Email verification failed.');
      setEmailMessage('Email verified successfully. You can now use this email to sign in.');
      setEmailRemaining(0);
      setEmailCode('');
      setEmailResendRemaining(0);
      window.location.reload();
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Email verification failed.');
    } finally {
      setEmailLoading(false);
    }
  };

  React.useEffect(() => {
    if (emailRemaining <= 0 && emailResendRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setEmailRemaining(value => Math.max(0, value - 1));
      setEmailResendRemaining(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailRemaining, emailResendRemaining]);

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    setPhotoError('');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const currentAddresses = shippingAddresses.length > 0 ? shippingAddresses : [{
        id: 'default',
        label: formData.shippingLabel.trim() || 'Home',
        recipientName: formData.shippingRecipientName.trim(),
        phone: formData.shippingPhone.trim(),
        country: 'Nigeria',
        state: formData.shippingState.trim(),
        lga: formData.shippingLga.trim(),
        town: formData.shippingTown.trim(),
        area: formData.shippingArea.trim(),
        fullAddress: formData.shippingFullAddress.trim(),
        landmark: formData.shippingLandmark.trim(),
        isDefault: true,
      } as ShippingAddress];
      const normalizedAddresses = currentAddresses.map(address => ({ ...address, label: address.label.trim() || 'Address', recipientName: address.recipientName.trim(), phone: address.phone.trim(), country: address.country || 'Nigeria', state: address.state.trim(), lga: address.lga.trim(), town: address.town.trim(), area: address.area.trim(), fullAddress: address.fullAddress.trim(), landmark: address.landmark?.trim() || '', isDefault: false }));
      const defaultId = normalizedAddresses.find(address => address.id === (defaultShipping?.id || 'default'))?.id || normalizedAddresses[0]?.id;
      const finalAddresses = normalizedAddresses.map(address => ({ ...address, isDefault: address.id === defaultId }));
      const fullName = [formData.firstName, formData.otherName, formData.lastName].filter(Boolean).join(' ').trim() || formData.fullName.trim();
      await updateDoc(userRef, {
        firstName: formData.firstName.trim(),
        otherName: formData.otherName.trim(),
        lastName: formData.lastName.trim(),
        fullName,
        username: formData.username.trim(),
        preferredLanguage: formData.preferredLanguage,
        communicationProfile: {
          ...(userData.communicationProfile || {}),
          firstName: formData.firstName.trim(),
          otherName: formData.otherName.trim(),
          lastName: formData.lastName.trim(),
          locationVisibility: formData.communicationLocationVisibility,
        },
        shippingAddresses: finalAddresses,
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

        <div className="mb-8 pb-8 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-4"><User className="w-5 h-5 text-slate-500"/><h3 className="text-lg font-bold text-slate-900">Customer ownership & communication profile</h3></div>
          <p className="text-sm text-slate-500 mb-4">You control the non-sensitive information people can use to recognize and communicate with you. Your phone, Unique ID, verification records, NIN/BVN, and PINs remain protected.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <input disabled={!isEditing} value={formData.firstName} onChange={e=>setFormData({...formData,firstName:e.target.value})} placeholder="First name" className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"/>
            <input disabled={!isEditing} value={formData.otherName} onChange={e=>setFormData({...formData,otherName:e.target.value})} placeholder="Other / middle name" className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"/>
            <input disabled={!isEditing} value={formData.lastName} onChange={e=>setFormData({...formData,lastName:e.target.value})} placeholder="Last name" className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"/>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <select disabled={!isEditing} value={formData.communicationLocationVisibility} onChange={e=>setFormData({...formData,communicationLocationVisibility:e.target.value as typeof formData.communicationLocationVisibility})} className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50">
              <option value="hidden">Communication location: Hidden</option>
              <option value="city_only">Communication location: City only</option>
              <option value="contacts">Communication location: Contacts</option>
              <option value="everyone">Communication location: Everyone</option>
            </select>
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
            <div className="flex flex-col gap-2">
              <input
                type="email"
                value={emailDraft}
                onChange={e => { setEmailDraft(e.target.value); setEmailError(''); setEmailMessage(''); }}
                disabled={userData.emailVerified === true || emailLoading}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
              {userData.emailVerified === true ? (
                <p className="text-xs text-green-600 font-medium">✓ Verified email — accepted as a login identifier.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Your email is optional. Verify it with UniqueOTP to use it for login.</p>
                  {emailRemaining > 0 && <p className="text-xs text-slate-500">Code expires in {Math.floor(emailRemaining / 60)}:{String(emailRemaining % 60).padStart(2, '0')}.</p>}
                  {emailResendRemaining > 0 && <p className="text-xs text-slate-400">Resend available in {emailResendRemaining}s.</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={requestEmailVerification} disabled={emailLoading || emailResendRemaining > 0} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">
                      {emailLoading ? 'Sending...' : emailRemaining > 0 ? 'Send again' : 'Verify email'}
                    </button>
                    {emailRemaining > 0 && <><input type="text" inputMode="numeric" maxLength={6} value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit UniqueOTP" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" /><button type="button" onClick={verifyEmail} disabled={emailLoading || emailRemaining <= 0} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">Verify</button></>}
                  </div>
                  {emailError && <p className="text-xs text-red-600">{emailError}</p>}
                  {emailMessage && <p className="text-xs text-green-600">{emailMessage}</p>}
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Phone Number
            </label>
            <p className="text-slate-900 font-medium">{userData.phone || <span className="text-slate-400 italic">Not set</span>}</p>
            {isEditing && <p className="text-xs text-slate-400 mt-1">Phone/Unique ID cannot be edited here. Use the protected phone-change verification flow.</p>}
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
        <div className="mt-8 pt-8 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-slate-500"/><h3 className="text-lg font-bold text-slate-900">Shipping Addresses</h3></div>
            {isEditing && <button type="button" onClick={() => setShippingAddresses(current => [...current, { id: 'address-' + Date.now(), label: 'New address', recipientName: formData.firstName + (formData.lastName ? ' ' + formData.lastName : ''), phone: userData.phone || '', country: 'Nigeria', state: '', lga: '', town: '', area: '', fullAddress: '', landmark: '', isDefault: current.length === 0 }])} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm">Add address</button>}
          </div>
          <p className="text-sm text-slate-500 mb-4">Keep multiple private delivery addresses such as Home, Office, or another destination. One address is always marked as the default for Store checkout.</p>
          <div className="space-y-4">
            {(shippingAddresses.length ? shippingAddresses : [{
              id: 'default', label: formData.shippingLabel || 'Home', recipientName: formData.shippingRecipientName || userData.fullName, phone: formData.shippingPhone || userData.phone || '', country: 'Nigeria', state: formData.shippingState, lga: formData.shippingLga, town: formData.shippingTown, area: formData.shippingArea, fullAddress: formData.shippingFullAddress, landmark: formData.shippingLandmark, isDefault: true
            } as ShippingAddress]).map((address, index) => (
              <div key={address.id} className="border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <input disabled={!isEditing} value={address.label} onChange={e=>setShippingAddresses(current=>current.map(item=>item.id===address.id?{...item,label:e.target.value}:item))} placeholder="Home / Office" className="px-3 py-2 border border-slate-200 rounded-lg font-semibold disabled:bg-slate-50"/>
                    {address.isDefault && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">Default</span>}
                  </div>
                  {isEditing && shippingAddresses.length > 1 && <button type="button" onClick={()=>setShippingAddresses(current=>{const remaining=current.filter(item=>item.id!==address.id); if(address.isDefault && remaining[0]) remaining[0]={...remaining[0],isDefault:true}; return remaining;})} className="text-xs text-red-600">Remove</button>}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {([
                    ['recipientName','Recipient name'],['phone','Delivery phone'],['state','State'],['lga','LGA'],['town','Town / City'],['area','Area'],['landmark','Landmark (optional)'],['fullAddress','Full address']
                  ] as const).map(([key,placeholder]) => key === 'fullAddress' ? (
                    <textarea key={key} disabled={!isEditing} value={address[key]} onChange={e=>setShippingAddresses(current=>current.map(item=>item.id===address.id?{...item,[key]:e.target.value}:item))} rows={2} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 sm:col-span-2"/>
                  ) : (
                    <input key={key} disabled={!isEditing} value={address[key] || ''} onChange={e=>setShippingAddresses(current=>current.map(item=>item.id===address.id?{...item,[key]:e.target.value}:item))} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"/>
                  ))}
                </div>
                {isEditing && <button type="button" onClick={()=>setShippingAddresses(current=>current.map(item=>({...item,isDefault:item.id===address.id})))} className="mt-3 text-sm text-slate-700 underline">Set as default checkout address</button>}
              </div>
            ))}
          </div>
        </div>        </div>
      </div>
    </div>
  );
}
