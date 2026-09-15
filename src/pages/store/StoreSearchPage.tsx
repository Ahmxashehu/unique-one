import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, Store as StoreIcon, Heart, Loader2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Product } from '../../lib/os/types';

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const filterCat = searchParams.get('cat') || '';
  
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        let q = query(collection(db, 'products'), where('status', '==', 'published'));
        if (filterCat) {
          q = query(q, where('category', '==', filterCat));
        }
        // Note: Firestore doesn't support full-text search natively without extensions like Algolia,
        // so we'll just fetch and filter client-side for this prototype if there's a search term.
        const querySnapshot = await getDocs(q);
        let results = querySnapshot.docs.map(doc => doc.data() as Product);
        
        if (initialQuery) {
          const lowerQ = initialQuery.toLowerCase();
          results = results.filter(p => p.name.toLowerCase().includes(lowerQ) || p.description.toLowerCase().includes(lowerQ));
        }
        
        setProducts(results);
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [initialQuery, filterCat]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: searchInput, cat: filterCat });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {initialQuery ? `Search results for "${initialQuery}"` : filterCat ? `Category: ${filterCat.replace('_', ' ')}` : 'All Products'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} products found.</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search store..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>
          <button type="button" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <div className="hidden md:block w-64 shrink-0 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Categories</h3>
            <div className="space-y-2">
              {['electronics', 'fashion', 'agriculture', 'building_materials', 'services'].map(cat => (
                <Link key={cat} to={`/store/search?cat=${cat}`} className={`block text-sm ${filterCat === cat ? 'text-blue-600 font-medium' : 'text-slate-600 hover:text-slate-900'} capitalize`}>
                  {cat.replace('_', ' ')}
                </Link>
              ))}
              <Link to="/store/search" className="block text-sm text-slate-400 hover:text-slate-600">Clear Category</Link>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Price Range</h3>
            <div className="flex gap-2">
              <input type="number" placeholder="Min" className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-900" />
              <input type="number" placeholder="Max" className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-900" />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">No products found</h3>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map(product => (
                <Link key={product.id} to={`/store/product/${product.id}`} className="group flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                  <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {product.images?.length > 0 ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <StoreIcon className="w-8 h-8 text-slate-300" />
                    )}
                    <button className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full text-slate-400 hover:text-red-500 transition-colors z-10" onClick={(e) => { e.preventDefault(); /* Add to wishlist logic */ }}>
                      <Heart className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded text-slate-700">
                      {product.condition}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                    <p className="text-lg font-bold text-slate-900 mt-auto">{product.currency === 'NGN' ? '₦' : '$'}{product.price.toLocaleString()}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                      <StoreIcon className="w-3 h-3" />
                      <span className="truncate">Seller View</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
