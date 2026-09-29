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
  const normalized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.slice(0, MAX_CONTEXT_STRING_LENGTH);
}

function toIsoString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }
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
      currency: safeString(data.currency, "unknown")!,
      itemCount: items.length,
      createdAt: toIsoString(data.createdAt),
    });
  }
  return Array.from(orders.values());
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
  }).slice(0, MAX_BUSINESS_CONTEXT + 1);
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
      currency: safeString(data.currency, "unknown")!,
      quantity:
        typeof data.quantity === "number" && Number.isFinite(data.quantity)
          ? data.quantity
          : undefined,
      status: safeString(data.status),
    };
  }).slice(0, MAX_PRODUCT_CONTEXT + 1);
}

export async function getAuthorizedPlatformContext(uid: string): Promise<UniqueAiPlatformContext> {
  const [user, loadedOrders, loadedBusinesses, loadedProducts] = await Promise.all([
    getAuthorizedUserContext(uid),
    getAuthorizedOrderContext(uid),
    getAuthorizedBusinessContext(uid),
    getAuthorizedProductContext(uid),
  ]);

  const sortNewestFirst = <T extends { id: string; createdAt?: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.NEGATIVE_INFINITY;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.NEGATIVE_INFINITY;
      if (bTime !== aTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    });

  const orderedOrders = sortNewestFirst(loadedOrders);
  const orderedBusinesses = sortNewestFirst(loadedBusinesses);
  const orderedProducts = sortNewestFirst(loadedProducts);
  // The +1 sentinel makes truncation explicit without exposing an unbounded query.
  const contextTruncated = {
    orders: orderedOrders.length > MAX_ORDER_CONTEXT,
    businesses: orderedBusinesses.length > MAX_BUSINESS_CONTEXT,
    products: orderedProducts.length > MAX_PRODUCT_CONTEXT,
  };
  const orders = orderedOrders.slice(0, MAX_ORDER_CONTEXT);
  const businesses = orderedBusinesses.slice(0, MAX_BUSINESS_CONTEXT);
  const products = orderedProducts.slice(0, MAX_PRODUCT_CONTEXT);

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
  const ordersMissingTotals = orders.filter((order) => order.totalAmount === undefined).length;
  const businessesMissingNames = businesses.filter((business) => !business.name.trim() || business.name === "Unnamed business").length;
  const productsMissingNames = products.filter((product) => !product.name.trim() || product.name === "Unnamed product").length;

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
    (product) => typeof product.quantity === "number" && product.quantity === 0,
  ).length;
  const productsWithInvalidQuantity = products.filter(
    (product) => typeof product.quantity === "number" && (!Number.isSafeInteger(product.quantity) || product.quantity < 0),
  ).length;

  return {
    user,
    orders,
    businesses,
    products,
    summary: {
      schemaVersion: 1,
      summaryVersion: "ai-40",
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
      productsWithInvalidQuantity,
      contextLimits: {
        orders: MAX_ORDER_CONTEXT,
        businesses: MAX_BUSINESS_CONTEXT,
        products: MAX_PRODUCT_CONTEXT,
      },
      contextTruncated: {
        orders: contextTruncated.orders,
        businesses: contextTruncated.businesses,
        products: contextTruncated.products,
      },
      contextComplete: !contextTruncated.orders && !contextTruncated.businesses && !contextTruncated.products,
      contextLoadedAt: new Date().toISOString(),
      coverage: {
        ordersLoaded: orders.length,
        businessesLoaded: businesses.length,
        productsLoaded: products.length,
        ordersOmitted: contextTruncated.orders ? Math.max(0, loadedOrders.length - orders.length) : 0,
        businessesOmitted: contextTruncated.businesses ? Math.max(0, loadedBusinesses.length - businesses.length) : 0,
        productsOmitted: contextTruncated.products ? Math.max(0, loadedProducts.length - products.length) : 0,
      },
      dataQuality: {
        ordersMissingTotals,
        businessesMissingNames,
        productsMissingNames,
      },
      requestScope: "authorized-user-context",
      contextWarnings: [
        ...(ordersMissingTotals > 0
          ? [`Loaded order context has ${ordersMissingTotals} record(s) without a supplied total amount.`]
          : []),
        ...(businessesMissingNames > 0
          ? [`Loaded business context has ${businessesMissingNames} record(s) using the fallback unnamed label.`]
          : []),
        ...(productsMissingNames > 0
          ? [`Loaded product context has ${productsMissingNames} record(s) using the fallback unnamed label.`]
          : []),
        ...(contextTruncated.orders
          ? [`Order context reached its limit of ${MAX_ORDER_CONTEXT} loaded records; additional records were not included.`]
          : []),
        ...(contextTruncated.businesses
          ? [`Business context reached its limit of ${MAX_BUSINESS_CONTEXT} loaded records; additional records were not included.`]
          : []),
        ...(contextTruncated.products
          ? [`Product context reached its limit of ${MAX_PRODUCT_CONTEXT} loaded records; additional records were not included.`]
          : []),
      ],
    },
  };
}
