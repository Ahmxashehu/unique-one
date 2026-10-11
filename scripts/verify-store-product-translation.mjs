import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log("PASS:", message);
};

const route = read("src/server/storeProductTranslationRoutes.ts");
const productPage = read("src/pages/store/StoreProductPage.tsx");
const storeSearchPage = read("src/pages/store/StoreSearchPage.tsx");
const wishlistPage = read("src/pages/WishlistPage.tsx");
const types = read("src/lib/os/types.ts");
const registrations = read("src/server/adminRbacRoutes.ts");
const packageJson = JSON.parse(read("package.json"));

for (const language of ["ha", "fr", "ig", "yo", "pcm"]) {
  assert(route.includes(`${language}: '`) || route.includes(`${language}: "`), `server translation target includes ${language}`);
}
assert(route.includes("productSnap.data()?.status !== 'published'"), "only published products can be translated");
assert(route.includes("process.env.GEMINI_API_KEY"), "translation API key stays server-side");
assert(route.includes("express-rate-limit") || route.includes("rateLimit({"), "translation endpoint is rate limited");
assert(route.includes("sourceHash(name, description, sourceVariants)"), "cache invalidates when product variant text changes");
assert(route.includes("['translations.' + language]"), "translation cache is stored per allow-listed language");
assert(route.includes("Do not add claims"), "translation prompt prohibits invented product claims");
assert(route.includes("variantsAreValid"), "variant translation counts are validated");
assert(productPage.includes("/api/store/products/") && productPage.includes("/translation?language="), "Store requests translation for the selected language");
assert(productPage.includes("unique-language-change"), "Store reacts when the user changes language");
assert(productPage.includes("translatedText?.language === language ? translatedText.name : product.name"), "Store falls back to the original product name");
assert(productPage.includes("translatedText?.language === language ? translatedText.description : product.description"), "Store falls back to the original product description");
assert(productPage.includes("value={option}"), "translated variant labels preserve original option values for cart selection");
assert(types.includes("translations?: Partial<Record<ProductLanguage, ProductTranslation>>"), "product type stores derived translations separately from original fields");
assert(registrations.includes("registerStoreProductTranslationRoutes(app)"), "public product translation route is registered");
assert(packageJson.scripts?.test?.includes("verify-store-product-translation.mjs"), "product translation checks are included in the test command");

assert(storeSearchPage.includes("unique-language-change"), "Store search reacts to selected-language changes");
assert(storeSearchPage.includes("product.translations?.[language as ProductLanguage]"), "Store search cards use persisted product translations");
assert(storeSearchPage.includes("/translation?language="), "Store search loads missing card translations from the server");
assert(storeSearchPage.includes("slice(0, 4)"), "Store search limits automatic translation requests to protect the API quota");
assert(storeSearchPage.includes("const translatedName"), "Store search displays translated product names with original-text fallback");
assert(storeSearchPage.includes("Number(product.price).toLocaleString()"), "Store search keeps canonical product prices unchanged");

const storeHomePage = read("src/pages/StorePage.tsx");
assert(storeHomePage.includes("unique-language-change"), "Store home reacts to selected-language changes");
assert(storeHomePage.includes("product.translations?.[language as ProductLanguage]"), "Store home uses persisted product translations");
assert(storeHomePage.includes("/translation?language="), "Store home requests translations for uncached products");
assert(storeHomePage.includes("getDisplayProductName(product)"), "Store home product, low-stock, and service cards use localized names");
assert(storeHomePage.includes("Number(product.price).toLocaleString()"), "Store home keeps canonical product prices unchanged");

assert(wishlistPage.includes("collection(db, 'wishlists')"), "Wishlist loads saved items for the signed-in user");
assert(wishlistPage.includes("doc(db, 'products', productId)"), "Wishlist resolves saved IDs to real product records");
assert(wishlistPage.includes("product.status !== 'published'"), "Wishlist hides unpublished or unavailable products");
assert(wishlistPage.includes("unique-language-change"), "Wishlist responds to selected-language changes");
assert(wishlistPage.includes("/translation?language="), "Wishlist requests cached server-side translations for saved product names");
assert(wishlistPage.includes("slice(0, 4)"), "Wishlist caps uncached translation requests");
assert(wishlistPage.includes("Number(product.price).toLocaleString()"), "Wishlist preserves canonical prices");
assert(wishlistPage.includes("deleteDoc(doc(db, 'wishlists'"), "Wishlist supports removing saved products");
