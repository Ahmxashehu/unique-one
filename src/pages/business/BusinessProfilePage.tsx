import React, { useEffect, useState } from 'react';
import { Store, MapPin, Phone, Mail, Edit, ImagePlus, Loader2 } from 'lucide-react';
import { collection, getDocs, query, updateDoc, where, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { uploadMedia } from '../../lib/media/upload';

export default function BusinessProfilePage() {
  const { currentUser } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);
  const [error, setError] = useState('');

  const loadBusiness = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'businesses'), where('ownerUid', '==', currentUser.uid)));
      setBusiness(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    } catch (err) {
      console.error(err);
      setError('Unable to load your business profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBusiness(); }, [currentUser?.uid]);

  const handleImage = async (event: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'cover') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUser || !business?.id) return;
    setError('');
    setUploading(kind);
    try {
      const media = await uploadMedia(file, {
        ownerId: currentUser.uid,
        pathPrefix: `businesses/${business.id}/media/${currentUser.uid}`,
        optimizeImage: true,
        imageMaxDimension: kind === 'cover' ? 1800 : 800,
        imageTargetBytes: kind === 'cover' ? 600 * 1024 : 350 * 1024,
      });
      await updateDoc(doc(db, 'businesses', business.id), {
        [kind === 'logo' ? 'logoUrl' : 'coverImageUrl']: media.downloadUrl,
        [kind === 'logo' ? 'logoMedia' : 'coverMedia']: media,
        updatedAt: new Date().toISOString(),
      });
      await loadBusiness();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || `Unable to upload business ${kind} image.`);
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div className="p-8 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading business profile…</div>;

  if (!business) return <div className="p-8 text-center text-slate-500">No registered business found for this account.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your public storefront details and images.</p>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="h-40 sm:h-48 bg-slate-900 relative overflow-hidden">
          {business.coverImageUrl && <img src={business.coverImageUrl} alt="" className="w-full h-full object-cover" />}
          <label className="absolute right-3 top-3 bg-white/95 backdrop-blur px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 shadow-sm cursor-pointer flex items-center gap-2">
            {uploading === 'cover' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {uploading === 'cover' ? 'Uploading…' : 'Change cover'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => void handleImage(e, 'cover')} disabled={!!uploading} />
          </label>

          <div className="absolute -bottom-10 left-6 sm:left-8 w-24 h-24 bg-white rounded-2xl border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
            {business.logoUrl ? <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" /> : <Store className="w-10 h-10 text-slate-400" />}
            <label className="absolute inset-0 bg-black/45 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <ImagePlus className="w-5 h-5 text-white" />
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => void handleImage(e, 'logo')} disabled={!!uploading} />
            </label>
          </div>
        </div>

        <div className="pt-14 px-6 sm:px-8 pb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{business.name}</h2>
              <span className="inline-flex mt-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                {business.verificationStatus === 'verified' ? 'Verified Business' : 'Verification pending'}
              </span>
            </div>
            <Store className="w-6 h-6 text-slate-300" />
          </div>

          <p className="text-slate-600 mt-6 leading-relaxed">{business.description || 'Add a description for your customers.'}</p>

          <div className="grid sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
            {business.address && <div className="flex items-center gap-3 text-slate-600"><MapPin className="w-5 h-5 text-slate-400" /><span>{business.address}</span></div>}
            {business.contactPhone && <div className="flex items-center gap-3 text-slate-600"><Phone className="w-5 h-5 text-slate-400" /><span>{business.contactPhone}</span></div>}
            {business.contactEmail && <div className="flex items-center gap-3 text-slate-600"><Mail className="w-5 h-5 text-slate-400" /><span>{business.contactEmail}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
