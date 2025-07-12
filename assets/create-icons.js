// Simple script to create different icon sizes from SVG
// This would typically use a tool like sharp or similar, but for now
// we'll create the basic structure for manual conversion

const iconSizes = {
  'icon-16x16.png': 16,
  'icon-32x32.png': 32,
  'icon-64x64.png': 64,
  'icon-128x128.png': 128,
  'icon-256x256.png': 256,
  'icon-512x512.png': 512,
  'icon-1024x1024.png': 1024
};

console.log('Icon sizes needed for macOS app:');
Object.entries(iconSizes).forEach(([filename, size]) => {
  console.log(`${filename}: ${size}x${size}px`);
});

console.log('\nTo convert SVG to PNG and create .icns file:');
console.log('1. Use online converter or tools like Inkscape/GIMP to convert icon.svg to PNG files');
console.log('2. Use iconutil (macOS) to create .icns file:');
console.log('   iconutil -c icns icon.iconset');
console.log('\nOr use online .icns generator with the 1024x1024 PNG version.');