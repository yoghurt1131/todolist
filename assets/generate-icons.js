const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 64, 128, 256, 512, 1024];

async function generateIcons() {
  try {
    console.log('🎨 Generating app icons from SVG...');
    
    const svgPath = path.join(__dirname, 'icon.svg');
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Generate PNG files for different sizes
    for (const size of sizes) {
      const outputPath = path.join(__dirname, `icon-${size}x${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png({ quality: 100 })
        .toFile(outputPath);
      
      console.log(`✅ Generated ${size}x${size} PNG`);
    }
    
    // Create the main icon.png (512x512 for general use)
    const mainIconPath = path.join(__dirname, 'icon.png');
    await sharp(svgBuffer)
      .resize(512, 512)
      .png({ quality: 100 })
      .toFile(mainIconPath);
    
    console.log('✅ Generated main icon.png (512x512)');
    
    // Generate iconset directory structure for macOS
    const iconsetDir = path.join(__dirname, 'icon.iconset');
    if (!fs.existsSync(iconsetDir)) {
      fs.mkdirSync(iconsetDir);
    }
    
    // macOS iconset naming convention
    const macSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' }
    ];
    
    for (const { size, name } of macSizes) {
      const outputPath = path.join(iconsetDir, name);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png({ quality: 100 })
        .toFile(outputPath);
    }
    
    console.log('✅ Generated iconset directory for macOS');
    console.log('');
    console.log('📝 To complete the icon setup:');
    console.log('1. Run: iconutil -c icns assets/icon.iconset');
    console.log('2. This will create assets/icon.icns for the final app bundle');
    console.log('');
    console.log('🎉 Icon generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateIcons();
}

module.exports = generateIcons;