export type UniqueAiUserContext = {
  fullName: string;
  uniqueOneId?: string;
  preferredLanguage?: string;
  roles: string[];
  status?: string;
  verificationStatus?: string;
};

export type UniqueAiOrderContext = {
  id: string;
  side: "customer" | "seller";
  status: string;
  totalAmount?: number;
  currency: string;
  itemCount: number;
  createdAt?: string;
};

export type UniqueAiBusinessContext = {
  id: string;
  name: string;
  category?: string;
  status?: string;
  verificationStatus?: string;
  createdAt?: string;
};

export type UniqueAiProductContext = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  currency: string;
  quantity?: number;
  status?: string;
};

export type UniqueAiConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

export type UniqueAiPlatformSummary = {
  schemaVersion: 1;
  orderCount: number;
  customerOrderCount: number;
  sellerOrderCount: number;
  orderStatusCounts: Record<string, number>;
  orderSideStatusCounts: Record<string, number>;
  activeOrderCount: number;
  cancelledOrderCount: number;
  ordersWithUnknownStatus: number;
  businessCount: number;
  businessCategoryCounts: Record<string, number>;
  businessStatusCounts: Record<string, number>;
  businessVerificationCounts: Record<string, number>;
  businessesWithoutCategory: number;
  businessesWithUnknownStatus: number;
  businessesWithUnknownVerification: number;
  productCount: number;
  productCategoryCounts: Record<string, number>;
  productStatusCounts: Record<string, number>;
  productsWithoutCategory: number;
  productsWithUnknownStatus: number;
  productsWithoutQuantity: number;
  inventoryUnitCount: number;
  productsWithQuantity: number;
  productsOutOfStock: number;
  contextLimits: { orders: number; businesses: number; products: number };
  contextTruncated: { orders: boolean; businesses: boolean; products: boolean };
  contextLoadedAt: string;
  contextWarnings: string[];
};

export type UniqueAiPlatformContext = {
  user: UniqueAiUserContext;
  orders: UniqueAiOrderContext[];
  businesses: UniqueAiBusinessContext[];
  products: UniqueAiProductContext[];
  summary: UniqueAiPlatformSummary;
};

export type UniqueAiRequest = {
  uid: string;
  message: unknown;
  history?: unknown;
};
