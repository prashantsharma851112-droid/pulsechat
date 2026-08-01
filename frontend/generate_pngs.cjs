const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(size, outputPath) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);

  const rowLen = 1 + size * 4;
  const rawData = Buffer.alloc(rowLen * size);

  const center = size / 2;
  const outerRadius = size * 0.42;

  for (let y = 0; y < size; y++) {
    const offset = y * rowLen;
    rawData[offset] = 0;
    for (let x = 0; x < size; x++) {
      const px = offset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Chat bubble & tail symbol
      const inBubble = (Math.abs(dx) < size * 0.18 && Math.abs(dy + size * 0.02) < size * 0.13) ||
                       (dx > -size * 0.20 && dx < -size * 0.08 && dy > size * 0.08 && dy < size * 0.20);

      if (dist <= outerRadius) {
        if (inBubble) {
          // Glowing White Chat Logo
          rawData[px] = 0xff;     // R
          rawData[px + 1] = 0xff; // G
          rawData[px + 2] = 0xff; // B
          rawData[px + 3] = 0xff; // A
        } else {
          // Vibrant Gradient (#6366f1 to #818cf8)
          const t = (x + y) / (size * 2);
          rawData[px] = Math.round(99 + t * 30);    // R
          rawData[px + 1] = Math.round(102 + t * 38); // G
          rawData[px + 2] = Math.round(241 + t * 7);  // B
          rawData[px + 3] = 0xff;
        }
      } else {
        // Sleek Dark Background (#0b0f19)
        rawData[px] = 0x0b;     // R
        rawData[px + 1] = 0x0f; // G
        rawData[px + 2] = 0x19; // B
        rawData[px + 3] = 0xff; // A
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(outputPath, pngBuffer);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([len, body, crc]);
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

createPng(192, path.join(publicDir, 'icon-192.png'));
createPng(512, path.join(publicDir, 'icon-512.png'));
createPng(512, path.join(publicDir, 'screenshot.png'));
console.log('✅ Generated stylish PulseChat PNG App Icons');
