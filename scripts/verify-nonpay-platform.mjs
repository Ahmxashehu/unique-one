import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return;
  }
  console.log("PASS:", message);
};

const requiredFiles = [
  "src/App.tsx",
  "server.ts",
  "src/pages/messages/MessagesPage.tsx",
  "src/pages/messages/ChatView.tsx",
  "src/lib/os/communication-db.ts",
  "src/pages/UniqueSharePage.tsx",
  "src/pages/StorePage.tsx",
  "src/pages/store/StoreOrdersPage.tsx",
  "src/pages/UniqueAiPage.tsx",
  "src/pages/public/FlightsPage.tsx",
  "src/pages/public/HotelsEventsPage.tsx",
  "src/pages/HealthWellnessPage.tsx",
  "src/pages/EducationHubPage.tsx",
  "src/server/uniqueShareRoutes.ts",
  "src/server/storeOrderLifecycleRoutes.ts",
  "src/server/storeInventoryLedger.ts",
  "firestore.rules",
  "storage.rules",
];
for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `required non-Pay platform file exists: ${file}`);
}

const app = read("src/App.tsx");
const appRoutes = [...app.matchAll(/path=["']\/?([^"']+)["']/g)].map((match) => match[1]);
for (const route of [
  "messages/*",
  "unique-share",
  "store",
  "ai",
  "flights",
  "hotels-events",
  "health-wellness",
  "education-hub",
]) {
  assert(appRoutes.includes(route), `frontend route is registered: ${route}`);
}

const server = read("server.ts");
for (const route of [
  '"/api/communication/conversations"',
  '"/api/communication/messages"',
  '"/api/store/checkout"',
  '"/api/ai/public-chat"',
  '"/api/ai/discovery"',
]) {
  assert(server.includes(route), `backend route surface is registered: ${route}`);
}

const share = read("src/server/uniqueShareRoutes.ts");
assert(share.includes('"/api/unique-share/sessions"'), "UniqueShare API routes are registered in their dedicated route module");
for (const safeguard of [
  "authenticate",
  "session.senderUid !== uid && session.receiverUid !== uid",
  "session.receiverUid !== uid",
  "actionLimiter",
  'import { getStorage } from "firebase-admin/storage"',
  "getStorage().bucket().file(String(file.storagePath)).getMetadata()",
  'custom.source !== "UniqueShare"',
  "custom.sessionId !== sessionId",
  "custom.senderUid !== uid",
  "actualSize !== Number(file.sizeBytes)",
  'UPLOAD_NOT_VERIFIED',
]) {
  assert(share.includes(safeguard), `UniqueShare authorization/transfer-verification safeguard exists: ${safeguard}`);
}

const storeLifecycle = read("src/server/storeOrderLifecycleRoutes.ts");
for (const safeguard of [
  "hasRolePermission",
  "authenticate",
  "rateLimit",
  "TRANSITIONS[currentStatus] !== targetStatus",
  "order.sellerId",
  "orderBusinessId === activeBusinessId",
  "orderBranchId === assignedBranchId",
  "DELIVERY_CONFIRMATION_REQUIRES_PROOF",
  "transaction.create(db.collection('audit_logs').doc()",
]) {
  assert(storeLifecycle.includes(safeguard), `Store order lifecycle safeguard exists: ${safeguard}`);
}

const inventoryLedger = read("src/server/storeInventoryLedger.ts");
for (const safeguard of [
  "INVALID_INVENTORY_MOVEMENT",
  "quantityDelta + input.previousQuantity !== input.resultingQuantity",
  "expectedDirection[input.movementType]?.includes(input.direction)",
  "Number.isSafeInteger(input.quantity)",
  "transaction.create(movementRef",
]) {
  assert(inventoryLedger.includes(safeguard), `Store inventory ledger invariant exists: ${safeguard}`);
}

const permissionRules = read("firestore.rules");
const userRules = permissionRules.slice(
  permissionRules.indexOf("match /users/{userId}"),
  permissionRules.indexOf("match /profiles/{userId}"),
);
assert(
  userRules.includes("request.resource.data.keys().hasOnly([") &&
    !userRules.includes("!('administrator' in request.resource.data.roles)"),
  "client-created user profiles cannot self-assign privileged roles, permissions, or status",
);
const jobRules = permissionRules.slice(
  permissionRules.indexOf("match /jobs/{jobId}"),
  permissionRules.indexOf("match /jobApplications/{applicationId}"),
);
assert(
  jobRules.includes("'business_owner' in get(") &&
    jobRules.includes("isAdmin()"),
  "job publishing requires a business-owner role or administrator authorization in Firestore rules",
);

const serviceRules = read("firestore.rules");
const serviceRequestRules = serviceRules.slice(
  serviceRules.indexOf("match /serviceRequests/{requestId}"),
  serviceRules.indexOf("match /professionalRequests/{requestId}"),
);
const professionalRequestRules = serviceRules.slice(
  serviceRules.indexOf("match /professionalRequests/{requestId}"),
  serviceRules.indexOf("match /workAgreements/{agreementId}"),
);
const agreementRules = serviceRules.slice(
  serviceRules.indexOf("match /workAgreements/{agreementId}"),
  serviceRules.indexOf("match /services/{serviceId}"),
);
assert(
  serviceRequestRules.includes("resource.data.status == 'requested'") &&
    serviceRequestRules.includes("resource.data.providerUid == request.auth.uid"),
  "service requests are limited to their named provider and one valid response transition",
);
assert(
  professionalRequestRules.includes("resource.data.requesterUid == request.auth.uid") &&
    professionalRequestRules.includes("request.resource.data.visibility == 'public'"),
  "professional requests enforce owner identity and explicit public publication",
);
assert(
  agreementRules.includes("request.resource.data.createdByUid == request.auth.uid") &&
    agreementRules.includes("request.resource.data.createdByUid == request.resource.data.clientUid || request.resource.data.createdByUid == request.resource.data.providerUid") &&
    agreementRules.includes("request.resource.data.clientAccepted == false") &&
    agreementRules.includes("request.resource.data.providerAccepted == false") &&
    agreementRules.includes("request.resource.data.status == ("),
  "work agreements enforce linked accepted requests and two-party acceptance state",
);
const serviceListingRules = serviceRules.slice(
  serviceRules.indexOf("match /services/{serviceId}"),
  serviceRules.indexOf("\n  }\n}", serviceRules.indexOf("match /services/{serviceId}")),
);
assert(
  serviceListingRules.includes("'business_owner' in get(") &&
    serviceListingRules.includes("isAdmin()"),
  "service listing create/update requires business-owner or administrator authorization",
);

const activeEdgeRules = read("firestore.rules");
const activeEdgePostRules = activeEdgeRules.slice(
  activeEdgeRules.indexOf("match /edgePosts/{postId}"),
  activeEdgeRules.indexOf("match /edgeStatuses/{statusId}"),
);
assert(
  activeEdgePostRules.includes("resource.data.audience == 'public'") &&
    activeEdgePostRules.includes("data.authorUid == request.auth.uid") &&
    activeEdgePostRules.includes("data.audience == 'public'") &&
    activeEdgePostRules.includes("allow read: if (exists("),
  "Active Edge follower-only posts and nested likes/comments are not publicly readable",
);
const discoverPage = read("src/pages/public/DiscoverPage.tsx");
assert(
  discoverPage.includes("where('audience', '==', 'public')") &&
    discoverPage.includes("where('authorUid', '==', currentUser.uid)") &&
    discoverPage.includes("Followers-only posting is temporarily disabled") &&
    discoverPage.includes("defaultAudience: 'public'"),
  "Active Edge feed explicitly queries public posts, retains the owner's private posts, and disables unsupported followers-only publishing",
);

const contributionRules = read("firestore.rules");
const contributionOfferRules = contributionRules.slice(
  contributionRules.indexOf("match /contributionOffers/{offerId}"),
  contributionRules.indexOf("match /businesses/{businessId}"),
);
assert(
  contributionOfferRules.includes("resource.data.status == 'pending'") &&
    contributionOfferRules.includes("request.resource.data.status == 'withdrawn'") &&
    contributionOfferRules.includes("request.resource.data.status in ['accepted','rejected']") &&
    contributionOfferRules.includes(".data.status == 'published'"),
  "contribution offers allow only one pending-to-final transition and require an open request for acceptance",
);

const educationRules = read("firestore.rules");
const educationTypes = read("src/lib/education/educationTypes.ts");
const educationPage = read("src/pages/EducationPage.tsx");
assert(
  educationRules.includes("request.resource.data.status == 'draft'") &&
    educationRules.includes("'pending_review'") &&
    educationRules.includes("isPlatformAdmin()"),
  "Education institutions and courses require draft creation and admin-controlled publication",
);
assert(
  educationTypes.includes("'pending_review'") &&
    educationPage.includes("requestInstitutionReview") &&
    educationPage.includes("requestCourseReview") &&
    educationPage.includes("Submit for review"),
  "EducationHub submits owner-created institutions/courses for review instead of self-publishing",
);

const communicationDocs = read("src/lib/os/communication-docs.md");
const chatView = read("src/pages/messages/ChatView.tsx");
const communicationDb = read("src/lib/os/communication-db.ts");
assert(
  /real-time message subscription code/i.test(communicationDocs),
  "communication documentation reflects implemented native messaging source",
);
assert(
  chatView.includes("subscribeToMessagesForConversation"),
  "chat UI subscribes to live conversation messages",
);
assert(
  communicationDb.includes("onSnapshot"),
  "communication data layer contains Firestore real-time subscriptions",
);
assert(
  /Not yet certified/i.test(communicationDocs),
  "communication documentation distinguishes source presence from production E2E certification",
);

const providerPages = [
  ["Flights", "src/pages/public/FlightsPage.tsx"],
  ["Hotels & Events", "src/pages/public/HotelsEventsPage.tsx"],
  ["Health & Wellness", "src/pages/HealthWellnessPage.tsx"],
];
for (const [feature, file] of providerPages) {
  const source = read(file);
  const hasExplicitStatus = /not connected|not been confirmed|cannot be submitted|unavailable|not yet/i.test(source);
  if (hasExplicitStatus) {
    console.warn(`BLOCKER (not a CI failure): ${feature} source still documents an unavailable/unverified live provider flow.`);
  } else {
    console.log(`REVIEW: ${feature} has no known unavailable-provider phrase; verify live integration manually.`);
  }
}

console.log("\nPay-excluded source-contract checks completed. These checks do not prove runtime behavior, provider connectivity, or end-to-end success.");
