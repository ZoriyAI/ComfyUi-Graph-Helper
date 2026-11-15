#!/usr/bin/env node
/**
 * Writes resources/icon.ico (Windows) and resources/icon.icns (macOS) from the PNG sizes in resources/icons/, with
 * plain Node: `node scripts/make-icon-containers.js`. scripts/render-icons.js runs it after drawing new PNGs, so the
 * three formats never drift apart. Electron Forge's packager picks the right file from packagerConfig.icon
 * ('resources/icon') when it builds for Windows or macOS; the Linux packages keep using the PNGs.
 */
const fs = require('fs');
const path = require('path');
const { buildIco, buildIcns } = require('./lib/icon-containers');

const root = path.join(__dirname, '..');
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

/** The committed PNGs as [size, buffer], smallest first. */
function readPngs(dir = path.join(root, 'resources', 'icons')) {
  return SIZES.map((size) => [size, fs.readFileSync(path.join(dir, `${size}x${size}.png`))]);
}

function main() {
  const images = readPngs();
  const ico = buildIco(images);
  const icns = buildIcns(images);
  fs.writeFileSync(path.join(root, 'resources', 'icon.ico'), ico);
  fs.writeFileSync(path.join(root, 'resources', 'icon.icns'), icns);
  console.log(`icon.ico ${ico.length} bytes, icon.icns ${icns.length} bytes`);
}

module.exports = { readPngs };

if (require.main === module) main();
