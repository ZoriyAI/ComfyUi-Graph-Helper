// Renders the app icon from its vector sources into every PNG size the Linux packages use.
// Who runs it: a maintainer after changing resources/icon.svg or resources/icon-small.svg:
//   xvfb-run -a npx electron scripts/render-icons.js
// Why Electron: it is already here and draws SVG exactly as the app does; no image tool is needed.
// 16 and 24 px come from icon-small.svg, drawn for those sizes (fine detail turns to mush there); the rest from icon.svg.
// Writes resources/icon.png (512, the window icon) and resources/icons/NxN.png (the desktop entry sizes), then
// resources/icon.ico and resources/icon.icns (the Windows and macOS builds) from those PNGs.
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

async function render(win, svgFile, size) {
  const svg = fs.readFileSync(svgFile, 'utf8');
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const data = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = ${size};
      canvas.height = ${size};
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, ${size}, ${size});
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('the SVG did not load'));
    image.src = ${JSON.stringify(url)};
  })`);
  return Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64');
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<html><body></body></html>');
  try {
    for (const size of SIZES) {
      const source = path.join(root, 'resources', size <= 24 ? 'icon-small.svg' : 'icon.svg');
      const png = await render(win, source, size);
      fs.writeFileSync(path.join(root, 'resources', 'icons', `${size}x${size}.png`), png);
      if (size === 512) fs.writeFileSync(path.join(root, 'resources', 'icon.png'), png);
      console.log(`icon ${size}x${size} ${png.length} bytes`);
    }
    // The .ico and .icns hold the same PNGs; plain Node packs them (scripts/make-icon-containers.js).
    execFileSync('node', [path.join(__dirname, 'make-icon-containers.js')], { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
  app.quit();
});
