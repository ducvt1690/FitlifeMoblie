// Turns a downloaded photo into the landing background: portrait 1290×2796 (iPhone Pro Max), JPEG under ~700 KB.
// Usage: npm run landing -- "C:\path\to\photo.jpg" [x]
//   x (optional, 0–1): where the portrait crop sits across a landscape photo, 0 = left edge, 1 = right edge.
//   Without it, sharp picks the most detailed region.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const [input, xArg] = process.argv.slice(2);
if (!input || !fs.existsSync(input)) {
  console.error('Cách dùng: npm run landing -- "<đường dẫn ảnh đã tải>" [vị trí ngang 0–1]');
  process.exit(1);
}
const target = path.join(__dirname, '..', 'assets', 'images', 'landing.jpg');
const W = 1290;
const H = 2796;
const LIMIT = 700 * 1024;

async function crop() {
  const image = sharp(input).rotate();
  if (xArg === undefined) return image.resize(W, H, { fit: 'cover', position: sharp.strategy.attention });
  const x = Math.min(Math.max(Number(xArg), 0), 1);
  const { width, height } = await image.metadata();
  const cropH = Math.min(height, Math.round(width * H / W));
  const cropW = Math.round(cropH * W / H);
  const left = Math.round((width - cropW) * x);
  return image.extract({ left, top: Math.round((height - cropH) / 2), width: cropW, height: cropH }).resize(W, H);
}

(async () => {
  const base = await crop();
  for (let quality = 82; quality >= 50; quality -= 6) {
    const buf = await base.clone().jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
    if (buf.length <= LIMIT || quality <= 56) {
      fs.writeFileSync(target, buf);
      console.log(`Đã lưu assets/images/landing.jpg (${Math.round(buf.length / 1024)} KB, chất lượng ${quality}).`);
      return;
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
