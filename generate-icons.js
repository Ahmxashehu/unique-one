const fs = require('fs');

// PWA icons are maintained as SVG assets in public/.
// Do not generate placeholder PNGs: the manifest intentionally uses the
// checked-in SVG icons so their dimensions and artwork remain authoritative.
const required = [
  'public/unique-icon.svg',
  'public/pwa-192x192.svg',
  'public/pwa-512x512.svg',
  'public/pwa-maskable-512x512.svg',
  'public/apple-touch-icon.svg',
];

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error('Missing PWA icon assets:', missing.join(', '));
  process.exit(1);
}

console.log('PWA icon assets verified:', required.join(', '));
