const fs = require('fs');
const file = 'src/pages/business/AddProductPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `    const productData: Product = {
      id: productId,
      sellerId: currentUser!.uid,
      name,
      description,
      category,
      images: [], // Placeholder for real image URLs after upload
      hasVideo,
      price: parseFloat(price),
      currency,
      discount: discount ? parseFloat(discount) : undefined,
      condition,
      quantity: parseInt(quantity, 10),
      minOrderQuantity: parseInt(minOrderQuantity, 10) || 1,
      wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : undefined,
      bulkPrice: bulkPrice ? parseFloat(bulkPrice) : undefined,
      location: { address: locationAddress, lat: 0, lng: 0 },
      deliveryOptions: deliveryOption ? ['standard_delivery'] : [],
      pickupOptions: pickupOption ? ['in_store_pickup'] : [],
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };`;

const replacement = `    const rawData = {
      id: productId,
      sellerId: currentUser!.uid,
      name,
      description,
      category,
      images: [], // Placeholder for real image URLs after upload
      hasVideo,
      price: parseFloat(price),
      currency,
      discount: discount ? parseFloat(discount) : undefined,
      condition,
      quantity: parseInt(quantity, 10),
      minOrderQuantity: parseInt(minOrderQuantity, 10) || 1,
      wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : undefined,
      bulkPrice: bulkPrice ? parseFloat(bulkPrice) : undefined,
      location: { address: locationAddress, lat: 0, lng: 0 },
      deliveryOptions: deliveryOption ? ['standard_delivery'] : [],
      pickupOptions: pickupOption ? ['in_store_pickup'] : [],
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const productData = Object.fromEntries(Object.entries(rawData).filter(([_, v]) => v !== undefined)) as unknown as Product;`;

if (code.includes('discount: discount ? parseFloat(discount) : undefined,')) {
    code = code.replace(target, replacement);
    fs.writeFileSync(file, code);
    console.log("Replaced!");
} else {
    console.log("Not found.");
}
