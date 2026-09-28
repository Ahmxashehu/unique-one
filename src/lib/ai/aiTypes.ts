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
  totalAmount: number;
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
  text: unknown;
};

export type UniqueAiPlatformSummary = {
  orderCount: number;
  customerOrderCount: number;
  sellerOrderCount: number;
  orderStatusCounts: Record<string, number>;
  orderSideStatusCounts: Record<string, number>;
  activeOrderCount: number;
  cancelledOrderCount: number;
  businessCount: number;
  businessCategoryCounts: Record<string, number>;
  businessStatusCounts: Record<string, number>;
  businessVerificationCounts: Record<string, number>;
  productCount: number;
  productCategoryCounts: Record<string, number>;
  productStatusCounts: Record<string, number>;
  productsWithoutCategory: number;
  inventoryUnitCount: number;
  productsWithQuantity: number;
  productsOutOfStock: number;
  contextLimits: { orders: number; businesses: number; products: number };
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
