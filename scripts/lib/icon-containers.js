/**
 * Packs the app icon's PNG sizes (resources/icons/NxN.png, drawn by scripts/render-icons.js) into the two container
 * formats the Windows and macOS builds need: resources/icon.ico (the .exe's icon, set by Electron Forge's packager)
 * and resources/icon.icns (the .app bundle's icon). Both formats may hold PNG data as it is, so no image tool and no
 * redrawing is needed: the containers show exactly the pictures the Linux packages ship.
 *
 * Used by scripts/make-icon-containers.js (and render-icons.js after it draws new PNGs); tests/unit/iconContainers
 * .test.ts checks the layout and that the committed files are what these functions make from the committed PNGs.
 */

/** The width and height a PNG declares in its IHDR chunk; throws for anything that is not a PNG. */
function pngSize(png) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (png.length < 24 || !png.subarray(0, 8).equals(signature) || png.subarray(12, 16).toString('latin1') !== 'IHDR') {
    throw new Error('not a PNG file');
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Every picture must be square and of the size it is filed under. */
function checkSizes(images) {
  for (const [size, png] of images) {
    const { width, height } = pngSize(png);
    if (width !== size || height !== size) throw new Error(`the ${size}px icon is ${width}x${height}`);
  }
}

/**
 * A Windows .ico with one PNG entry per size (Windows Vista and later read PNG entries; 256 is the largest an .ico
 * holds, written as 0 in the directory). `images` is a list of [size, png buffer], smallest first.
 */
function buildIco(images) {
  checkSizes(images);
  const usable = images.filter(([size]) => size <= 256);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(usable.length, 4);
  const entries = [];
  let offset = 6 + 16 * usable.length;
  for (const [size, png] of usable) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...usable.map(([, png]) => png)]);
}

/**
 * The .icns element types that take PNG data, with the pixel size each needs. The "@2x" types (ic11 to ic14) are
 * the Retina variants of 16, 32, 128 and 256 points and reuse the next larger picture.
 */
const ICNS_TYPES = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512],
];

/** A macOS .icns: the 'icns' header and one PNG element for every type whose size is among `images`. */
function buildIcns(images) {
  checkSizes(images);
  const bySize = new Map(images);
  const elements = [];
  for (const [type, size] of ICNS_TYPES) {
    const png = bySize.get(size);
    if (!png) continue;
    const head = Buffer.alloc(8);
    head.write(type, 0, 'latin1');
    head.writeUInt32BE(png.length + 8, 4);
    elements.push(head, png);
  }
  const body = Buffer.concat(elements);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'latin1');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

module.exports = { buildIco, buildIcns, pngSize, ICNS_TYPES };
