const fs = require('fs');
const path = require('path');

// SVG icon template
function makeSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#0f172a"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.55}" font-weight="bold" fill="#38bdf8" text-anchor="middle" dominant-baseline="central">S</text>
</svg>`;
}

// Tulis SVG
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), makeSvg(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), makeSvg(512));

console.log('✅ SVG icon dibuat di public/');
console.log('');
console.log('⚠️  SVG belum bisa langsung dipakai sebagai PNG.');
console.log('   Konversi SVG ke PNG dengan cara:');
console.log('   1. Buka https://cloudconvert.com/svg-to-png');
console.log('   2. Upload icon-192.svg → convert → download sebagai icon-192.png');
console.log('   3. Upload icon-512.svg → convert → download sebagai icon-512.png');
console.log('   4. Letakkan di folder public/');