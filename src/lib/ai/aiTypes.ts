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

export type UniqueAiPlatformContext = {
  user: UniqueAiUserContext;
  orders: UniqueAiOrderContext[];
  businesses: UniqueAiBusinessContext[];
  products: UniqueAiProductContext[];
};

export type UniqueAiRequest = {
  uid: string;
  message: unknown;
  history?: unknown;
};
