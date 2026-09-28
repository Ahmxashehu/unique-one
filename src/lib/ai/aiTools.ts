import { getFirestore } from "firebase-admin/firestore";
import type {
  UniqueAiBusinessContext,
  UniqueAiOrderContext,
  UniqueAiPlatformContext,
  UniqueAiProductContext,
  UniqueAiUserContext,
} from "./aiTypes";

const MAX_ORDER_CONTEXT = 20;
const MAX_BUSINESS_CONTEXT = 5;
const MAX_PRODUCT_CONTEXT = 30;
const MAX_CONTEXT_STRING_LENGTH = 160;

function safeString(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, MAX_CONTEXT_STRING_LENGTH);
}

function toIsoString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

export async function getAuthorizedUserContext(uid: string): Promise<UniqueAiUserContext> {
  const snapshot = await getFirestore().collection("users").doc(uid).get();
  if (!snapshot.exists) return { fullName: "Unique One user", roles: [] };

  const data = snapshot.data() ?? {};
  return {
    fullName: safeString(data.fullName, "Unique One user")!,
    uniqueOneId: safeString(data.uniqueOneId),
    preferredLanguage: safeString(data.preferredLanguage),
    roles: Array.isArray(data.roles)
      ? data.roles.filter((role): role is string => typeof role === "string").slice(0, 20)
      : [],
    status: safeString(data.status),
    verificationStatus: safeString(data.verificationStatus),
  };
}

export async function getAuthorizedOrderContext(uid: string): Promise<UniqueAiOrderContext[]> {
  const db = getFirestore();
  const [customerSnapshot, sellerSnapshot] = await Promise.all([
    db.collection("orders").where("customerId", "==", uid).limit(MAX_ORDER_CONTEXT + 1).get(),
    db.collection("orders").where("sellerId", "==", uid).limit(MAX_ORDER_CONTEXT + 1).get(),
  ]);

  const orders = new Map<string, UniqueAiOrderContext>();
  for (const snapshot of [
    ...customerSnapshot.docs.map((doc) => ({ doc, side: "customer" as const })),
    ...sellerSnapshot.docs.map((doc) => ({ doc, side: "seller" as const })),
  ]) {
    const data = snapshot.doc.data();
    const items = Array.isArray(data.items) ? data.items : [];
    orders.set(snapshot.doc.id, {
      id: snapshot.doc.id,
      side: snapshot.side,
      status: safeString(data.status, "unknown")!,
      totalAmount:
        typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount)
          ? data.totalAmount
          : undefined,
      currency: safeString(data.currency, "NGN")!,
      itemCount: items.length,
      createdAt: toIsoString(data.createdAt),
    });
  }
  return Array.from(orders.values()).slice(0, MAX_ORDER_CONTEXT);
}

export async function getAuthorizedBusinessContext(uid: string): Promise<UniqueAiBusinessContext[]> {
  const snapshot = await getFirestore()
    .collection("businesses")
    .where("ownerUid", "==", uid)
    .limit(MAX_BUSINESS_CONTEXT + 1)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: safeString(data.name, safeString(data.businessName, "Unnamed business"))!,
      category: safeString(data.category),
      status: safeString(data.status),
      verificationStatus: safeString(data.verificationStatus),
      createdAt: toIsoString(data.createdAt),
    };
  });
}

export async function getAuthorizedProductContext(uid: string): Promise<UniqueAiProductContext[]> {
  const snapshot = await getFirestore()
    .collection("products")
    .where("sellerId", "==", uid)
    .limit(MAX_PRODUCT_CONTEXT + 1)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: safeString(data.name, "Unnamed product")!,
      category: safeString(data.category),
      price:
        typeof data.price === "number" && Number.isFinite(data.price) ? data.price : undefined,
      currency: safeString(data.currency, "NGN")!,
      quantity:
        typeof data.quantity === "number" && Number.isFinite(data.quantity)
          ? data.quantity
          : undefined,
      status: safeString(data.status),
    };
  });
}

export async function getAuthorizedPlatformContext(uid: string): Promise<UniqueAiPlatformContext> {
  const [user, orders, businesses, products] = await Promise.all([
    getAuthorizedUserContext(uid),
    getAuthorizedOrderContext(uid),
    getAuthorizedBusinessContext(uid),
    getAuthorizedProductContext(uid),
  ]);

  const orderStatusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, {});

  const orderSideStatusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const key = `${order.side}:${order.status}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  const businessCategoryCounts = businesses.reduce<Record<string, number>>((counts, business) => {
    const category = business.category ?? "Uncategorized";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

  const businessStatusCounts = businesses.reduce<Record<string, number>>((counts, business) => {
    const status = business.status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  const businessVerificationCounts = businesses.reduce<Record<string, number>>((counts, business) => {
    const status = business.verificationStatus ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  const productCategoryCounts = products.reduce<Record<string, number>>((counts, product) => {
    const category = product.category ?? "Uncategorized";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

  const productStatusCounts = products.reduce<Record<string, number>>((counts, product) => {
    const status = product.status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  const productsWithoutCategory = products.filter((product) => !product.category).length;
  const productsWithoutQuantity = products.filter((product) => product.quantity === undefined).length;
  const productsWithUnknownStatus = products.filter((product) => !product.status).length;
  const businessesWithoutCategory = businesses.filter((business) => !business.category).length;
  const businessesWithUnknownStatus = businesses.filter((business) => !business.status).length;
  const businessesWithUnknownVerification = businesses.filter(
    (business) => !business.verificationStatus,
  ).length;
  const ordersWithUnknownStatus = orders.filter((order) => order.status === "unknown").length;

  const inventoryUnitCount = products.reduce(
    (total, product) =>
      total + (typeof product.quantity === "number" && product.quantity > 0 ? product.quantity : 0),
    0,
  );

  const activeOrderCount = orders.filter(
    (order) => !["cancelled", "refunded"].includes(order.status),
  ).length;
  const cancelledOrderCount = orders.filter((order) => order.status === "cancelled").length;
  const productsWithQuantity = products.filter(
    (product) => typeof product.quantity === "number" && product.quantity > 0,
  ).length;
  const productsOutOfStock = products.filter(
    (product) => typeof product.quantity === "number" && product.quantity <= 0,
  ).length;

  return {
    user,
    orders,
    businesses,
    products,
    summary: {
      orderCount: orders.length,
      customerOrderCount: orders.filter((order) => order.side === "customer").length,
      sellerOrderCount: orders.filter((order) => order.side === "seller").length,
      orderStatusCounts,
      orderSideStatusCounts,
      activeOrderCount,
      cancelledOrderCount,
      ordersWithUnknownStatus,
      businessCount: businesses.length,
      businessCategoryCounts,
      businessStatusCounts,
      businessVerificationCounts,
      businessesWithoutCategory,
      businessesWithUnknownStatus,
      businessesWithUnknownVerification,
      productCount: products.length,
      productCategoryCounts,
      productStatusCounts,
      productsWithoutCategory,
      productsWithUnknownStatus,
      productsWithoutQuantity,
      inventoryUnitCount,
      productsWithQuantity,
      productsOutOfStock,
      contextLimits: {
        orders: MAX_ORDER_CONTEXT,
        businesses: MAX_BUSINESS_CONTEXT,
        products: MAX_PRODUCT_CONTEXT,
      },
      contextTruncated: {
        orders: orders.length > MAX_ORDER_CONTEXT,
        businesses: businesses.length > MAX_BUSINESS_CONTEXT,
        products: products.length > MAX_PRODUCT_CONTEXT,
      },
      contextLoadedAt: new Date().toISOString(),
      contextWarnings: [
        ...(orders.length > MAX_ORDER_CONTEXT
          ? [`Order context reached its limit of ${MAX_ORDER_CONTEXT} loaded records.`]
          : []),
        ...(businesses.length > MAX_BUSINESS_CONTEXT
          ? [`Business context reached its limit of ${MAX_BUSINESS_CONTEXT}.`]
          : []),
        ...(products.length > MAX_PRODUCT_CONTEXT
          ? [`Product context reached its limit of ${MAX_PRODUCT_CONTEXT}.`]
          : []),
      ],
    },
  };
}
