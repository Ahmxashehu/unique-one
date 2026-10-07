export type Role = 
  | 'customer' | 'buyer' | 'seller' | 'business_owner' | 'staff_member' 
  | 'farmer' | 'service_provider' | 'school_administrator' | 'parent' 
  | 'healthcare_provider' | 'property_owner' | 'hotel_owner' | 'driver' 
  | 'logistics_provider' | 'moderator' | 'administrator' | 'partner' | 'developer'
  | 'finance_officer' | 'risk_security_officer' | 'platform_admin' | 'super_admin';

export type Permission = 
  | 'view:profile' | 'edit:profile' | 'create:products' | 'edit:products' 
  | 'manage:inventory' | 'create:invoices' | 'send:payment_requests' 
  | 'view:customer_info' | 'manage:orders' | 'manage:bookings' 
  | 'manage:business_staff' | 'view:transactions' | 'manage:verification' 
  | 'manage:disputes' | 'access:admin_tools' | 'manage:roles' | 'manage:permissions' 
  | 'view:audit_logs';

export interface UniqueUser {
  uid: string;
  email: string;
  phone?: string;
  phoneVerified?: boolean;
  username?: string;
  uniqueOneId: string;
  firstName?: string;
  otherName?: string;
  lastName?: string;
  fullName: string;
  emailVerified?: boolean;
  profilePhotoUrl?: string;
  preferredLanguage: string;
  location?: { lat: number; lng: number; address: string };
  address?: { country: string; state: string; lga: string; town: string; area: string; fullAddress: string; landmark?: string };
  shippingAddresses?: Array<{ id: string; label: string; recipientName: string; phone: string; country: string; state: string; lga: string; town: string; area: string; fullAddress: string; landmark?: string; isDefault: boolean }>;
  communicationProfile?: { firstName?: string; otherName?: string; lastName?: string; profilePhotoUrl?: string; locationVisibility?: 'hidden' | 'city_only' | 'contacts' | 'everyone' };
  roles: Role[];
  permissions: Permission[];
  status: 'active' | 'suspended' | 'pending_verification' | 'banned';
  createdAt: string;
  lastLogin: string;
  verificationStatus: 'unverified' | 'email_verified' | 'phone_verified' | 'fully_verified';
  hasSecurePin: boolean;
  twoFactorEnabled: boolean;
}

export interface Business {
  id: string;
  ownerUid: string;
  name: string;
  registrationNumber?: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  categories: string[];
  status: 'pending' | 'verified' | 'rejected' | 'suspended';
  verificationStatus: 'unverified' | 'documents_submitted' | 'verified';
  createdAt: string;
}

export interface BusinessBranch {
  id: string;
  businessId: string;
  name: string;
  location: { lat: number; lng: number; address: string };
  isHeadquarters: boolean;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  ownerUid: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  uid: string;
  roleId: string;
  status: 'active' | 'inactive';
}

export interface Session {
  id: string;
  uid: string;
  deviceInfo: string;
  ipAddress: string;
  lastActive: string;
  isValid: boolean;
}

export interface Device {
  id: string;
  uid: string;
  name: string;
  isTrusted: boolean;
  lastUsed: string;
}

export interface AuditLog {
  id: string;
  uid: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export type ProductCategory = 
  | 'electronics' | 'electricity_power' | 'phones_accessories' | 'fashion' | 'shoes' | 'beauty'
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

export type OrderStatus = 'draft' | 'pending' | 'paid' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled' | 'refunded' | 'disputed';

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