const fs = require('fs');
let code = fs.readFileSync('src/lib/os/types.ts', 'utf-8');

const newTypes = `
export type ProductCategory = 
  | 'electronics' | 'phones_accessories' | 'fashion' | 'shoes' | 'beauty'
  | 'home_furniture' | 'building_materials' | 'cement' | 'agriculture'
  | 'fertilizer' | 'seeds' | 'farm_equipment' | 'food_groceries'
  | 'machinery' | 'vehicles' | 'property' | 'services' | 'digital_products' | 'other';

export type ProductCondition = 'new' | 'used' | 'refurbished';
export type ProductStatus = 'draft' | 'published' | 'out_of_stock';

export interface Product {
  id: string;
  sellerId: string;
  businessId?: string;
  name: string;
  description: string;
  category: ProductCategory;
  images: string[];
  hasVideo: boolean;
  price: number;
  currency: string;
  discount?: number;
  condition: ProductCondition;
  quantity: number;
  minOrderQuantity: number;
  wholesalePrice?: number;
  bulkPrice?: number;
  variants?: { name: string; options: string[] }[];
  location: { address: string; lat: number; lng: number };
  deliveryOptions: string[];
  pickupOptions: string[];
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | 'disputed';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: Record<string, string>;
}

export interface Order {
  id: string;
  customerId: string;
  sellerId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'draft' | 'published' | 'receiving_responses' | 'quote_received' | 'negotiating' | 'accepted' | 'cancelled' | 'expired' | 'completed';

export interface ProductRequest {
  id: string;
  customerId: string;
  title: string;
  description: string;
  quantity: number;
  budget: number;
  location: string;
  requiredDate: string;
  images?: string[];
  isPublic: boolean;
  expiryDate: string;
  status: RequestStatus;
  createdAt: string;
}

export interface Quote {
  id: string;
  requestId: string;
  sellerId: string;
  amount: number;
  quantity: number;
  deliveryCost: number;
  estimatedDeliveryTime: string;
  terms: string;
  expiryDate: string;
  notes?: string;
  attachments?: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  createdAt: string;
}

export interface CartItem {
  id: string;
  customerId: string;
  productId: string;
  quantity: number;
}

export interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  targetId: string; // productId or sellerId
  targetType: 'product' | 'seller';
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}
`;

fs.writeFileSync('src/lib/os/types.ts', code + newTypes);
