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
    fullName: typeof data.fullName === "string" ? data.fullName : "Unique One user",
    uniqueOneId: typeof data.uniqueOneId === "string" ? data.uniqueOneId : undefined,
    preferredLanguage: typeof data.preferredLanguage === "string" ? data.preferredLanguage : undefined,
    roles: Array.isArray(data.roles)
      ? data.roles.filter((role): role is string => typeof role === "string").slice(0, 20)
      : [],
    status: typeof data.status === "string" ? data.status : undefined,
    verificationStatus: typeof data.verificationStatus === "string"
      ? data.verificationStatus
      : undefined,
  };
}

export async function getAuthorizedOrderContext(uid: string): Promise<UniqueAiOrderContext[]> {
  const db = getFirestore();
  const [customerSnapshot, sellerSnapshot] = await Promise.all([
    db.collection("orders").where("customerId", "==", uid).limit(MAX_ORDER_CONTEXT).get(),
    db.collection("orders").where("sellerId", "==", uid).limit(MAX_ORDER_CONTEXT).get(),
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
      status: typeof data.status === "string" ? data.status : "unknown",
      totalAmount: typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount)
        ? data.totalAmount
        : 0,
      currency: typeof data.currency === "string" ? data.currency : "NGN",
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
    .limit(MAX_BUSINESS_CONTEXT)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: typeof data.name === "string"
        ? data.name
        : typeof data.businessName === "string"
          ? data.businessName
          : "Unnamed business",
      category: typeof data.category === "string" ? data.category : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
      verificationStatus: typeof data.verificationStatus === "string"
        ? data.verificationStatus
        : undefined,
      createdAt: toIsoString(data.createdAt),
    };
  });
}

export async function getAuthorizedProductContext(uid: string): Promise<UniqueAiProductContext[]> {
  const snapshot = await getFirestore()
    .collection("products")
    .where("sellerId", "==", uid)
    .limit(MAX_PRODUCT_CONTEXT)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: typeof data.name === "string" ? data.name : "Unnamed product",
      category: typeof data.category === "string" ? data.category : undefined,
      price: typeof data.price === "number" && Number.isFinite(data.price) ? data.price : undefined,
      currency: typeof data.currency === "string" ? data.currency : "NGN",
      quantity: typeof data.quantity === "number" && Number.isFinite(data.quantity) ? data.quantity : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
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

  return { user, orders, businesses, products };
}
