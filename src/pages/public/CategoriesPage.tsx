import React from 'react';
import { Grid, ShoppingBag, Briefcase, Car, Home, Cpu, Heart, Utensils } from 'lucide-react';

const categories = [
  { name: 'Retail & Shopping', icon: ShoppingBag, color: 'bg-blue-50 text-blue-600' },
  { name: 'Professional Services', icon: Briefcase, color: 'bg-indigo-50 text-indigo-600' },
  { name: 'Transportation', icon: Car, color: 'bg-emerald-50 text-emerald-600' },
  { name: 'Real Estate', icon: Home, color: 'bg-amber-50 text-amber-600' },
  { name: 'Technology', icon: Cpu, color: 'bg-slate-100 text-slate-700' },
  { name: 'Health & Wellness', icon: Heart, color: 'bg-rose-50 text-rose-600' },
  { name: 'Food & Dining', icon: Utensils, color: 'bg-orange-50 text-orange-600' },
  { name: 'More Categories', icon: Grid, color: 'bg-slate-100 text-slate-600' },
];

export default function CategoriesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Categories</h1>
        <p className="text-slate-500 mt-2 text-lg">Browse the ecosystem by industry.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.name} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow cursor-pointer group flex flex-col items-center text-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${cat.color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-8 h-8" />
              </div>
              <span className="font-semibold text-slate-900">{cat.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
