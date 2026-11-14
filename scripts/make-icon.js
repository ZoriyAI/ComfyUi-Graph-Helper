#!/usr/bin/env node
/**
 * Writes resources/icon.png (512×512 RGBA): the app mark in the night palette — a rounded square, two
 * coloured nodes linked by a cyan curve. Pure Node: pixels in a buffer, PNG chunks with zlib and CRC-32.
 * Usage: node scripts/make-icon.js [output.png] [size]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA pixels (width*height*4) → PNG bytes (colour type 6, 8 bits, filter 0 per row). */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0;
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;

/** Signed distance to a rounded rectangle centred at (cx, cy). */
function roundedRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - halfW + radius;
  const qy = Math.abs(py - cy) - halfH + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

function drawIcon(size) {
  const s = size / 512;
  const rgba = Buffer.alloc(size * size * 4);
  const curve = [];
  const p0 = [176 * s, 300 * s];
  const p3 = [336 * s, 212 * s];
  for (let i = 0; i <= 400; i += 1) curve.push(bezier(p0, [270 * s, 300 * s], [242 * s, 212 * s], p3, i / 400));
  const nodes = [
    { x: 150 * s, y: 300 * s, w: 70 * s, h: 50 * s, color: [139, 92, 246] }, // violet
    { x: 362 * s, y: 212 * s, w: 70 * s, h: 50 * s, color: [251, 146, 60] }, // amber
  ];
  const cyan = [34, 211, 238];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      let r = 0;
      let g = 0;
      let b = 0;
      // Rounded square background: a night gradient, top-left lighter.
      const bgDistance = roundedRect(px, py, size / 2, size / 2, 236 * s, 236 * s, 96 * s);
      let alpha = clamp01(0.5 - bgDistance);
      const t = clamp01((px + py) / (2 * size));
      r = mix(30, 12, t);
      g = mix(36, 15, t);
      b = mix(58, 28, t);
      // Faint grid dots like the canvas.
      if ((x % Math.round(32 * s)) < 2 * s && (y % Math.round(32 * s)) < 2 * s) {
        r += 14; g += 16; b += 26;
      }
      // Cyan link with a soft glow.
      let nearest = Infinity;
      for (let i = 0; i < curve.length; i += 4) {
        const d = Math.hypot(px - curve[i][0], py - curve[i][1]);
        if (d < nearest) nearest = d;
      }
      const glow = clamp01(1 - nearest / (28 * s)) * 0.35;
      r = mix(r, cyan[0], glow); g = mix(g, cyan[1], glow); b = mix(b, cyan[2], glow);
      const line = clamp01(9 * s - nearest + 0.5);
      r = mix(r, cyan[0], line); g = mix(g, cyan[1], line); b = mix(b, cyan[2], line);
      // Two nodes: rounded cards with a bright header strip and an outline.
      for (const node of nodes) {
        const d = roundedRect(px, py, node.x, node.y, node.w, node.h, 16 * s);
        const fill = clamp01(0.5 - d);
        if (fill <= 0) continue;
        const header = py < node.y - node.h + 26 * s;
        const base = header ? node.color : node.color.map((c) => c * 0.35 + 20);
        const edge = clamp01(1 - Math.abs(d + 2 * s) / (2.5 * s));
        const tone = base.map((c, i) => mix(c, node.color[i] * 0.6 + 100, edge * 0.6));
        r = mix(r, tone[0], fill); g = mix(g, tone[1], fill); b = mix(b, tone[2], fill);
      }
      // Ports where the link meets the nodes.
      for (const port of [[nodes[0].x + nodes[0].w, nodes[0].y], [nodes[1].x - nodes[1].w, nodes[1].y]]) {
        const d = Math.hypot(px - port[0], py - port[1]);
        const dot = clamp01(14 * s - d + 0.5);
        r = mix(r, 236, dot); g = mix(g, 254, dot); b = mix(b, 255, dot);
        const ring = clamp01(14 * s - Math.abs(d - 14 * s) * 4);
        r = mix(r, cyan[0], ring * 0.8); g = mix(g, cyan[1], ring * 0.8); b = mix(b, cyan[2], ring * 0.8);
      }
      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(clamp01(r / 255) * 255);
      rgba[offset + 1] = Math.round(clamp01(g / 255) * 255);
      rgba[offset + 2] = Math.round(clamp01(b / 255) * 255);
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

function makeIcon(output, size = 512) {
  const png = encodePng(size, size, drawIcon(size));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, png);
  return png;
}

module.exports = { crc32, encodePng, drawIcon, makeIcon };

if (require.main === module) {
  const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'resources', 'icon.png');
  const size = Number(process.argv[3]) || 512;
  const png = makeIcon(output, size);
  console.log(`ICON ${path.relative(process.cwd(), output)} ${size}x${size} ${png.length} bytes`);
}
