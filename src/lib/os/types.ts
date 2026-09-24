export type Role = 
  | 'customer' | 'buyer' | 'seller' | 'business_owner' | 'staff_member' 
  | 'farmer' | 'service_provider' | 'school_administrator' | 'parent' 
  | 'healthcare_provider' | 'property_owner' | 'hotel_owner' | 'driver' 
  | 'logistics_provider' | 'moderator' | 'administrator' | 'partner' | 'developer';

export type Permission = 
  | 'view:profile' | 'edit:profile' | 'create:products' | 'edit:products' 
  | 'manage:inventory' | 'create:invoices' | 'send:payment_requests' 
  | 'view:customer_info' | 'manage:orders' | 'manage:bookings' 
  | 'manage:business_staff' | 'view:transactions' | 'manage:verification' 
  | 'manage:disputes' | 'access:admin_tools';

export interface UniqueUser {
  uid: string;
  email: string;
  phone?: string;
  username?: string;
  uniqueOneId: string; // e.g. U1-XXXXXX
  fullName: string;
  profilePhotoUrl?: string;
  preferredLanguage: string;
  location?: { lat: number; lng: number; address: string };
  roles: Role[];
  permissions: Permission[]; // Custom overrides
  status: 'active' | 'suspended' | 'pending_verification' | 'banned';
  createdAt: string; // ISO String
  lastLogin: string; // ISO String
  verificationStatus: 'unverified' | 'email_verified' | 'phone_verified' | 'fully_verified';
  hasSecurePin: boolean; // Do not store PIN, just boolean flag
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
  type: string; // e.g. 'school', 'hospital', 'farm_coop'
  ownerUid: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string; // or businessId
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

export type PaymentRequestStatus = 'draft' | 'sent' | 'viewed' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'processing' | 'paid' | 'failed' | 'reversed' | 'disputed';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'disputed';
export type TransactionType = 'payment' | 'transfer' | 'refund' | 'fee' | 'invoice_payment' | 'school_payment' | 'merchant_payment' | 'bulk_payment' | 'reversal';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed' | 'disputed';

export interface PaymentRequestModel {
  id: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  recipientIdentifier: string;
  amount: number;
  currency: string;
  description: string;
  invoiceId?: string;
  orderId?: string;
  dueDate?: string;
  expiryDate?: string;
  notes?: string;
  status: PaymentRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceModel {
  id: string;
  businessId?: string;
  sellerId: string;
  customerId?: string;
  customerContact: string;
  items: InvoiceItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  status: InvoiceStatus;
  relatedOrderId?: string;
  relatedRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptModel {
  id: string;
  transactionRef: string;
  customerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  description: string;
  relatedOrderId?: string;
  relatedInvoiceId?: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  verificationRef: string;
  isDemo: boolean;
}

export interface TransactionModel {
  id: string;
  reference: string;
  senderId: string;
  recipientId: string;
  amountMinor: number;
  currency: 'NGN';
  type: TransactionType;
  sourceModule: string;
  relatedOrderId?: string;
  relatedInvoiceId?: string;
  relatedRequestId?: string;
  provider: string; // e.g., 'unique_pay_demo', 'paystack', 'flutterwave'
  status: TransactionStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  reversalReason?: string;
}

// UniquePay Types
export interface Wallet {
  uid: string;
  currency: 'NGN';
  availableBalanceMinor: number;
  status: 'active' | 'suspended' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  idempotencyKey: string;
  reference: string;
  uid: string;
  direction: 'debit' | 'credit';
  amountMinor: number;
  currency: 'NGN';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  createdAt: string;
}

export interface WalletIdempotencyRecord {
  id: string; // Deterministic key: `${uid}:${idempotencyKey}`
  uid: string;
  idempotencyKey: string;
  request: {
    recipientId: string;
    amountMinor: number;
    currency: 'NGN';
    description?: string;
  };
  result: {
    transactionId: string;
    reference: string;
    status: TransactionStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProvider {
  id: string;
  name: string; // 'paystack', 'flutterwave', 'monnify', 'remita', 'interswitch'
  status: 'active' | 'inactive' | 'maintenance' | 'integration_pending';
  supportedCurrencies: string[];
  capabilities: string[]; // 'initiate_transfer', 'receive_webhook', 'card_payment', 'bank_transfer', 'ussd', 'qr'
}

export interface WebhookEvent {
  id: string;
  providerId: string;
  eventId: string;
  eventType: string; // 'payment.successful', 'transfer.failed'
  payload: any;
  status: 'received' | 'processing' | 'processed' | 'failed' | 'retrying';
  reconciliationStatus: 'pending' | 'matched' | 'discrepancy' | 'manual_review';
  receivedAt: string;
}

export interface TemporaryReceivingId {
  id: string;
  uid: string; // receiver
  businessId?: string;
  tempId: string; // The generated ID (e.g. 10-digit number or code)
  purpose: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'cancelled' | 'used';
  createdAt: string;
}

export interface Beneficiary {
  id: string;
  uid: string; // owner of the beneficiary record
  beneficiaryId?: string; // If they have a Unique One ID
  identifier: string; // Phone, Email, or Bank Account
  name: string;
  type: 'user' | 'business' | 'school' | 'bank_account';
  bankCode?: string;
  addedAt: string;
}

export interface SchoolOrganization {
  id: string;
  name: string;
  adminUid: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
}

export interface Student {
  id: string;
  schoolId: string;
  parentUid: string;
  studentName: string;
  studentReference: string; // e.g. admission number
  class: string;
  status: 'active' | 'inactive';
}

export interface SchoolFeeItem {
  id: string;
  schoolId: string;
  name: string; // 'Tuition', 'Uniform', 'Exam Fee'
  amount: number;
  currency: string;
  academicTerm: string;
}

export interface BulkPaymentBatch {
  id: string;
  uid: string;
  businessId?: string;
  totalAmount: number;
  itemCount: number;
  successCount: number;
  failedCount: number;
  status: 'draft' | 'pending_approval' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

// Business Operating System Types
export interface StaffMember {
  id: string;
  businessId: string;
  uid: string;
  role: 'owner' | 'admin' | 'manager' | 'sales' | 'cashier' | 'accountant' | 'inventory' | 'support' | 'delivery' | 'branch_manager' | 'viewer';
  permissions: string[];
  branchId?: string;
  status: 'active' | 'suspended' | 'invited';
  invitedAt: string;
  joinedAt?: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  address: {
    state: string;
    lga: string;
    city: string;
    area: string;
    landmark?: string;
  };
  contactPhone: string;
  managerId?: string;
  operatingHours: string;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface InventoryLog {
  id: string;
  businessId: string;
  productId: string;
  branchId?: string;
  quantity: number;
  action: 'stock_in' | 'stock_out' | 'adjustment' | 'damaged' | 'returned';
  reason?: string;
  staffId: string;
  referenceId?: string;
  timestamp: string;
}

export interface BusinessCustomer {
  id: string;
  businessId: string;
  uid?: string; // If registered in Unique One
  name: string;
  phone: string;
  email?: string;
  customerType: 'retail' | 'wholesale' | 'corporate';
  deliveryAddress?: string;
  outstandingBalance: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  category: string;
  outstandingAmount: number;
  notes?: string;
  verificationStatus: 'unverified' | 'verified';
  createdAt: string;
}

export interface Expense {
  id: string;
  businessId: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  recordedBy: string;
  receiptUrl?: string;
}

export interface BusinessActivityLog {
  id: string;
  businessId: string;
  branchId?: string;
  actorId: string;
  action: string;
  recordType: string;
  recordId?: string;
  timestamp: string;
}

// Messaging Types

export type ConversationType = 'direct' | 'group' | 'business' | 'support' | 'order' | 'payment' | 'invoice' | 'store_listing';

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[]; // UIDs or BusinessIDs
  title?: string; // For groups or support
  image?: string; // Group image
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCounts: Record<string, number>;
  
  // Context references
  businessId?: string;
  orderId?: string;
  invoiceId?: string;
  paymentRequestId?: string;
  productId?: string;
  serviceId?: string;
  supportId?: string;
  
  creatorId?: string;
  adminIds?: string[];
  status: 'active' | 'archived' | 'muted' | 'closed'; // closed for support
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MessageReaction {
  userId: string;
  reaction: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  replyToId?: string;
  status: MessageStatus;
  isSystemMessage?: boolean;
  createdAt: string;
}

export interface UserPresence {
  uid: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string;
}

export interface SupportConversation {
  id: string;
  uid: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in_review' | 'waiting' | 'resolved' | 'closed';
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
}
