import { ProductCategory } from '../../lib/os/types';

type PrototypeStock = {
  category: ProductCategory;
  categoryLabel: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
};

const prototypeStock: PrototypeStock[] = [
  { category: 'electronics', categoryLabel: 'Electronics', name: 'Smart LED TV', price: 285000, quantity: 12 },
  { category: 'electronics', categoryLabel: 'Electronics', name: 'Bluetooth Speaker', price: 48000, quantity: 24 },
  { category: 'electronics', categoryLabel: 'Electronics', name: 'Home Sound System', price: 175000, quantity: 8 },
  { category: 'electronics', categoryLabel: 'Electronics', name: 'Smart Decoder', price: 32000, quantity: 30 },
  { category: 'electricity_power', categoryLabel: 'Electricity & Power', name: 'Solar Inverter 3.5kVA', price: 420000, quantity: 6 },
  { category: 'electricity_power', categoryLabel: 'Electricity & Power', name: 'Rechargeable Solar Fan', price: 95000, quantity: 15 },
  { category: 'electricity_power', categoryLabel: 'Electricity & Power', name: 'Solar Panel 450W', price: 185000, quantity: 10 },
  { category: 'electricity_power', categoryLabel: 'Electricity & Power', name: 'Rechargeable LED Bulb', price: 8500, quantity: 40 },
  { category: 'beauty', categoryLabel: 'Beauty', name: 'Skincare Set', price: 28000, quantity: 18 },
  { category: 'beauty', categoryLabel: 'Beauty', name: 'Hair Care Bundle', price: 35000, quantity: 14 },
  { category: 'beauty', categoryLabel: 'Beauty', name: 'Perfume Collection', price: 42000, quantity: 20 },
  { category: 'beauty', categoryLabel: 'Beauty', name: 'Beauty Essentials Kit', price: 22500, quantity: 25 },
  { category: 'fashion', categoryLabel: 'Fashion', name: 'Men’s Clothing Set', price: 45000, quantity: 16 },
  { category: 'fashion', categoryLabel: 'Fashion', name: 'Women’s Casual Set', price: 38000, quantity: 20 },
  { category: 'fashion', categoryLabel: 'Fashion', name: 'Traditional Wear', price: 75000, quantity: 9 },
  { category: 'fashion', categoryLabel: 'Fashion', name: 'Kids Clothing Bundle', price: 30000, quantity: 22 },
  { category: 'phones_accessories', categoryLabel: 'Phones & Accessories', name: 'Android Smartphone', price: 185000, quantity: 20 },
  { category: 'phones_accessories', categoryLabel: 'Phones & Accessories', name: 'Fast Charger & Cable', price: 12500, quantity: 35 },
  { category: 'shoes', categoryLabel: 'Shoes', name: 'Men’s Sneakers', price: 35000, quantity: 18, unit: 'pairs' },
  { category: 'shoes', categoryLabel: 'Shoes', name: 'Women’s Casual Shoes', price: 32000, quantity: 16, unit: 'pairs' },
  { category: 'home_furniture', categoryLabel: 'Home & Furniture', name: 'Modern Sofa Set', price: 320000, quantity: 6 },
  { category: 'home_furniture', categoryLabel: 'Home & Furniture', name: 'Dining Table Set', price: 185000, quantity: 8 },
  { category: 'building_materials', categoryLabel: 'Building Materials', name: 'POP Ceiling Materials', price: 85000, quantity: 20 },
  { category: 'building_materials', categoryLabel: 'Building Materials', name: 'Quality Paint 20L', price: 48000, quantity: 30 },
  { category: 'cement', categoryLabel: 'Cement', name: 'POP Cement 40kg', price: 12500, quantity: 50 },
  { category: 'cement', categoryLabel: 'Cement', name: 'Premium Cement 50kg', price: 14000, quantity: 45 },
  { category: 'agriculture', categoryLabel: 'Agriculture', name: 'Maize Seed Pack', price: 18000, quantity: 25 },
  { category: 'agriculture', categoryLabel: 'Agriculture', name: 'Farm Crop Starter Kit', price: 65000, quantity: 12 },
  { category: 'fertilizer', categoryLabel: 'Fertilizer', name: 'NPK Fertilizer 50kg', price: 48000, quantity: 35 },
  { category: 'fertilizer', categoryLabel: 'Fertilizer', name: 'Organic Fertilizer 25kg', price: 28000, quantity: 22 },
  { category: 'seeds', categoryLabel: 'Seeds', name: 'Hybrid Maize Seeds', price: 22000, quantity: 30 },
  { category: 'seeds', categoryLabel: 'Seeds', name: 'Vegetable Seed Collection', price: 15000, quantity: 40 },
  { category: 'farm_equipment', categoryLabel: 'Farm Equipment', name: 'Knapsack Sprayer', price: 45000, quantity: 14 },
  { category: 'farm_equipment', categoryLabel: 'Farm Equipment', name: 'Small Farm Tiller', price: 380000, quantity: 5 },
  { category: 'food_groceries', categoryLabel: 'Food & Groceries', name: 'Family Grocery Basket', price: 75000, quantity: 18 },
  { category: 'food_groceries', categoryLabel: 'Food & Groceries', name: 'Rice 50kg', price: 78000, quantity: 25 },
  { category: 'machinery', categoryLabel: 'Machinery', name: 'Portable Generator', price: 420000, quantity: 7 },
  { category: 'machinery', categoryLabel: 'Machinery', name: 'Industrial Water Pump', price: 285000, quantity: 9 },
  { category: 'vehicles', categoryLabel: 'Vehicles', name: 'Family Sedan', price: 8500000, quantity: 3 },
  { category: 'vehicles', categoryLabel: 'Vehicles', name: 'Utility Van', price: 12500000, quantity: 2 },
  { category: 'property', categoryLabel: 'Property', name: 'Residential Plot', price: 6500000, quantity: 5 },
  { category: 'property', categoryLabel: 'Property', name: 'Two-Bedroom Apartment', price: 35000000, quantity: 2 },
  { category: 'services', categoryLabel: 'Services', name: 'Professional Home Service', price: 25000, quantity: 10 },
  { category: 'services', categoryLabel: 'Services', name: 'Business Support Package', price: 50000, quantity: 8 },
  { category: 'digital_products', categoryLabel: 'Digital Products', name: 'Business Template Pack', price: 15000, quantity: 50 },
  { category: 'digital_products', categoryLabel: 'Digital Products', name: 'Digital Learning Bundle', price: 25000, quantity: 40 },
];

export { prototypeStock };
