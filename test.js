const rawData = {
  discount: undefined,
  name: "Test"
}
const productData = Object.fromEntries(Object.entries(rawData).filter(([_, v]) => v !== undefined));
console.log(productData);
