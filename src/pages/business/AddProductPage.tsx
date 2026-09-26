import React, { useState } from 'react';
import { PackagePlus, Upload, Save, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ProductCategory, ProductCondition, ProductStatus, Product } from '../../lib/os/types';

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'phones_accessories', label: 'Phones and Accessories' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'home_furniture', label: 'Home and Furniture' },
  { value: 'building_materials', label: 'Building Materials' },
  { value: 'cement', label: 'Cement' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'seeds', label: 'Seeds' },
  { value: 'farm_equipment', label: 'Farm Equipment' },
  { value: 'food_groceries', label: 'Food and Groceries' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'property', label: 'Property' },
  { value: 'services', label: 'Services' },
  { value: 'digital_products', label: 'Digital Products' },
  { value: 'other', label: 'Other Products' },
];

export default function AddProductPage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('other');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [discount, setDiscount] = useState('');
  const [condition, setCondition] = useState<ProductCondition>('new');
  const [quantity, setQuantity] = useState('');
  const [minOrderQuantity, setMinOrderQuantity] = useState('1');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [locationAddress, setLocationAddress] = useState(userData?.location?.address || '');
  const [deliveryOption, setDeliveryOption] = useState(true);
  const [pickupOption, setPickupOption] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);

  const handleSubmit = async (e: React.FormEvent, status: ProductStatus) => {
    e.preventDefault();
    if (!currentUser) {
      setError('Please sign in before adding a product.');
      navigate('/login');
      return;
    }

    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const parsedPrice = Number(price);
    const parsedQuantity = Number(quantity);
    const parsedMinOrder = Number(minOrderQuantity);
    const parsedDiscount = discount ? Number(discount) : undefined;
    const parsedWholesale = wholesalePrice ? Number(wholesalePrice) : undefined;
    const parsedBulk = bulkPrice ? Number(bulkPrice) : undefined;

    if (!cleanName || !cleanDescription || !price || !quantity) {
      setError('Please fill all required fields (Name, Description, Price, Quantity).');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid product price.');
      return;
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      setError('Quantity must be a whole number of 0 or more.');
      return;
    }
    if (!Number.isInteger(parsedMinOrder) || parsedMinOrder < 1) {
      setError('Minimum order quantity must be at least 1.');
      return;
    }
    if (parsedMinOrder > parsedQuantity && parsedQuantity > 0) {
      setError('Minimum order quantity cannot exceed available quantity.');
      return;
    }
    if (parsedDiscount !== undefined && (!Number.isFinite(parsedDiscount) || parsedDiscount < 0)) {
      setError('Enter a valid discount.');
      return;
    }
    if (parsedWholesale !== undefined && (!Number.isFinite(parsedWholesale) || parsedWholesale < 0)) {
      setError('Enter a valid wholesale price.');
      return;
    }
    if (parsedBulk !== undefined && (!Number.isFinite(parsedBulk) || parsedBulk < 0)) {
      setError('Enter a valid bulk price.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const productId = doc(collection(db, 'products')).id;
      const now = new Date().toISOString();

      const productData: Product = {
        id: productId,
        sellerId: currentUser.uid,
        name: cleanName,
        description: cleanDescription,
        category,
        images: [],
        hasVideo,
        price: parsedPrice,
        currency,
        condition,
        quantity: parsedQuantity,
        minOrderQuantity: parsedMinOrder,
        location: { address: locationAddress.trim(), lat: 0, lng: 0 },
        deliveryOptions: deliveryOption ? ['standard_delivery'] : [],
        pickupOptions: pickupOption ? ['in_store_pickup'] : [],
        status,
        createdAt: now,
        updatedAt: now,
        ...(parsedDiscount !== undefined ? { discount: parsedDiscount } : {}),
        ...(parsedWholesale !== undefined ? { wholesalePrice: parsedWholesale } : {}),
        ...(parsedBulk !== undefined ? { bulkPrice: parsedBulk } : {}),
      };

      await setDoc(doc(db, 'products', productId), productData);

      setSuccess(true);
      window.setTimeout(() => navigate('/os/business/dashboard'), 800);
    } catch (err) {
      console.error('Failed to save product:', err);
      setError(err instanceof Error ? err.message : 'Unable to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Product</h1>
        <p className="text-sm text-slate-500 mt-1">List a product or service to the Unique Store marketplace.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3">
          <PackagePlus className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Product saved successfully! Redirecting...</p>
        </div>
      )}

      <form className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Wireless Headphones" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select value={category} onChange={e => setCategory(e.target.value as ProductCategory)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
                    {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                  <select value={condition} onChange={e => setCondition(e.target.value as ProductCondition)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
                    <option value="new">Brand New</option>
                    <option value="used">Used / Second Hand</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" placeholder="Describe your product..." required />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Pricing & Inventory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Retail Price *</label>
                <div className="flex">
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="px-4 py-3 border border-r-0 border-slate-200 rounded-l-xl bg-slate-50 focus:outline-none">
                    <option value="NGN">₦ NGN</option>
                    <option value="USD">$ USD</option>
                  </select>
                  <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full px-4 py-3 rounded-r-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0.00" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Available Quantity *</label>
                <input type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="100" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wholesale Price (Optional)</label>
                <input type="number" min="0" step="0.01" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bulk Price (Optional)</label>
                <input type="number" min="0" step="0.01" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Order Quantity</label>
                <input type="number" min="1" step="1" value={minOrderQuantity} onChange={e => setMinOrderQuantity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discount (Optional)</label>
                <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Logistics</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Location</label>
              <input type="text" value={locationAddress} onChange={e => setLocationAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="City, State, or exact address" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={deliveryOption} onChange={e => setDeliveryOption(e.target.checked)} className="w-5 h-5 rounded text-slate-900 focus:ring-slate-900" />
                <span className="text-sm font-medium text-slate-700">Offers Delivery</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pickupOption} onChange={e => setPickupOption(e.target.checked)} className="w-5 h-5 rounded text-slate-900 focus:ring-slate-900" />
                <span className="text-sm font-medium text-slate-700">Allows Pickup</span>
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Media</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Product Images</label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-medium text-slate-900">Image upload is not connected yet</p>
                <p className="text-sm text-slate-500 mt-1">The product can be saved now; real media storage will be connected separately.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input type="checkbox" checked={hasVideo} onChange={e => setHasVideo(e.target.checked)} className="w-5 h-5 rounded text-slate-900 focus:ring-slate-900" />
              <span className="text-sm font-medium text-slate-700">I have a product video ready</span>
            </label>
          </section>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <button type="button" onClick={(e) => handleSubmit(e, 'draft')} disabled={loading} className="px-6 py-2.5 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Save as Draft
          </button>
          <button type="button" onClick={(e) => handleSubmit(e, 'published')} disabled={loading} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish Product
          </button>
        </div>
      </form>
    </div>
  );
}
