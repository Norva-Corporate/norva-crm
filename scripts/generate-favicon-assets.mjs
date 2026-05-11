import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('src/app/icon.svg');
const OUT_DIR = path.resolve('src/app');

async function main() {
  const svg = await fs.readFile(SRC);

  const icoSizes = [16, 32, 48];
  const pngs = await Promise.all(
    icoSizes.map((size) =>
      sharp(svg, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    ),
  );

  const ico = buildIco(pngs.map((data, i) => ({ size: icoSizes[i], data })));
  await fs.writeFile(path.join(OUT_DIR, 'favicon.ico'), ico);

  const apple = await sharp(svg, { density: 384 })
    .resize(180, 180, { fit: 'contain', background: { r: 11, g: 18, b: 32, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(path.join(OUT_DIR, 'apple-icon.png'), apple);

  console.log('OK:');
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'favicon.ico'))}  (${icoSizes.join(', ')})`);
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'apple-icon.png'))}  (180x180)`);
}

function buildIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const count = images.length;
  let offset = headerSize + entrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((img) => img.data)]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
