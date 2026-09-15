import React from 'react';
import { Link } from 'react-router-dom';

export default function StoreCategoriesPage() {
  const categories = [
    { id: 'electronics', name: 'Electronics & Gadgets', icon: '💻' },
    { id: 'phones_accessories', name: 'Phones & Accessories', icon: '📱' },
    { id: 'fashion', name: 'Fashion & Clothing', icon: '👕' },
    { id: 'shoes', name: 'Shoes & Footwear', icon: '👟' },
    { id: 'beauty', name: 'Health & Beauty', icon: '💄' },
    { id: 'home_furniture', name: 'Home & Furniture', icon: '🛋️' },
    { id: 'building_materials', name: 'Building Materials', icon: '🏗️' },
    { id: 'cement', name: 'Cement & Blocks', icon: '🧱' },
    { id: 'agriculture', name: 'Agriculture & Farming', icon: '🌾' },
    { id: 'fertilizer', name: 'Fertilizers & Chemicals', icon: '🧪' },
    { id: 'seeds', name: 'Seeds & Plants', icon: '🌱' },
    { id: 'farm_equipment', name: 'Farm Equipment', icon: '🚜' },
    { id: 'food_groceries', name: 'Food & Groceries', icon: '🥫' },
    { id: 'machinery', name: 'Industrial Machinery', icon: '⚙️' },
    { id: 'vehicles', name: 'Vehicles & Parts', icon: '🚗' },
    { id: 'property', name: 'Real Estate & Property', icon: '🏠' },
    { id: 'services', name: 'Professional Services', icon: '🔧' },
    { id: 'digital_products', name: 'Digital Products', icon: '💾' },
    { id: 'other', name: 'Other Categories', icon: '📦' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">All Categories</h1>
        <p className="text-sm text-slate-500 mt-1">Browse the full Unique Store catalog</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {categories.map(cat => (
          <Link key={cat.id} to={`/store/search?cat=${cat.id}`} className="flex flex-col items-center gap-4 p-6 bg-white border border-slate-100 rounded-2xl hover:shadow-md hover:border-slate-300 transition-all text-center group">
            <div className="text-4xl group-hover:scale-110 transition-transform">{cat.icon}</div>
            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{cat.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
