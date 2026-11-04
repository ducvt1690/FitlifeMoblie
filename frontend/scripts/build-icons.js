// Draws the dumbbell logo (same shapes as src/ui/Logo.js) into every icon Expo needs.
// Run after changing the logo: npm run icons
const path = require('node:path');
const sharp = require('sharp');

const ACCENT = '#C6F432';
const DUMBBELL = [
  { x: 26, y: 45.5, w: 48, h: 9, r: 2 },
  { x: 22, y: 27, w: 11, h: 46, r: 5.5 },
  { x: 67, y: 27, w: 11, h: 46, r: 5.5 },
  { x: 10, y: 35, w: 9.5, h: 30, r: 4.75 },
  { x: 80.5, y: 35, w: 9.5, h: 30, r: 4.75 },
];

// `scale` shrinks the mark around the centre (Android adaptive icons crop the outer third).
function svg({ size, tile, rounded = false, color = ACCENT, scale = 1 }) {
  const mark = DUMBBELL.map(p => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r}" fill="${color}"/>`).join('');
  const t = (1 - scale) * 50;
  const bg = tile === 'gradient'
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A2010"/><stop offset="1" stop-color="#07090C"/></linearGradient></defs>
       <rect width="100" height="100" ${rounded ? 'rx="22"' : ''} fill="url(#g)"/>`
    : tile ? `<rect width="100" height="100" fill="${tile}"/>` : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${bg}
    <g transform="translate(${t} ${t}) scale(${scale}) rotate(-30 50 50)">${mark}</g></svg>`);
}

const out = (name) => path.join(__dirname, '..', 'assets', name);
const jobs = [
  ['icon.png', { size: 1024, tile: 'gradient', scale: 0.84 }],
  ['android-icon-foreground.png', { size: 1024, scale: 0.5 }],
  ['android-icon-background.png', { size: 1024, tile: 'gradient' }],
  ['android-icon-monochrome.png', { size: 1024, scale: 0.5, color: '#FFFFFF' }],
  ['splash-icon.png', { size: 1024, scale: 0.9 }],
  ['favicon.png', { size: 196, tile: 'gradient', rounded: true, scale: 0.8 }],
];

(async () => {
  for (const [name, opts] of jobs) {
    await sharp(svg(opts)).png().toFile(out(name));
    console.log('wrote assets/' + name);
  }
})().catch((e) => { console.error(e); process.exit(1); });
