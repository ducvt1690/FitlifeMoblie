// Turns a downloaded photo into the landing background: portrait 1290×2796 (iPhone Pro Max), JPEG under ~700 KB.
// Usage: npm run landing -- "C:\path\to\photo.jpg"
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const input = process.argv[2];
if (!input || !fs.existsSync(input)) {
  console.error('Cách dùng: npm run landing -- "<đường dẫn ảnh đã tải>"');
  process.exit(1);
}
const target = path.join(__dirname, '..', 'assets', 'images', 'landing.jpg');
const LIMIT = 700 * 1024;

(async () => {
  // `attention` keeps the most detailed part of the photo (the dumbbell) inside the crop.
  const base = sharp(input).rotate().resize(1290, 2796, { fit: 'cover', position: sharp.strategy.attention });
  for (let quality = 82; quality >= 50; quality -= 6) {
    const buf = await base.clone().jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
    if (buf.length <= LIMIT || quality <= 56) {
      fs.writeFileSync(target, buf);
      console.log(`Đã lưu assets/images/landing.jpg (${Math.round(buf.length / 1024)} KB, chất lượng ${quality}).`);
      return;
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
