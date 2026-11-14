// Composes the wide pictures for the top of the README and for the repository's social preview from a real
// screenshot of the app (docs/screenshots/en/05-assistant-build.png): the window on a night backdrop, nothing drawn
// into the interface and no product name, so the picture stays true to the app and survives a rename.
// Who runs it: scripts/capture-screens/public.js, right after the screenshots (or alone, after them):
//   xvfb-run -a npx electron --no-sandbox scripts/capture-screens/hero.js
// Writes docs/screenshots/hero.png (1600x800) and docs/screenshots/social-preview.png (1280x640, GitHub's size).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const SOURCE = path.join(root, 'docs/screenshots/en/05-assistant-build.png');
const OUTPUTS = [
  { file: 'docs/screenshots/hero.png', width: 1600, height: 800 },
  { file: 'docs/screenshots/social-preview.png', width: 1280, height: 640 },
];

async function compose(win, width, height) {
  const source = `data:image/png;base64,${fs.readFileSync(SOURCE).toString('base64')}`;
  const data = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const W = ${width}, H = ${height};
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const c = canvas.getContext('2d');
      // The night of the app's own canvas, with the soft violet and cyan light it has under its toolbar.
      c.fillStyle = '#0a0e15'; c.fillRect(0, 0, W, H);
      let glow = c.createRadialGradient(W * 0.25, -H * 0.1, 0, W * 0.25, -H * 0.1, W * 0.7);
      glow.addColorStop(0, 'rgba(183,165,255,0.22)'); glow.addColorStop(1, 'rgba(183,165,255,0)');
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
      glow = c.createRadialGradient(W * 0.85, H * 1.1, 0, W * 0.85, H * 1.1, W * 0.6);
      glow.addColorStop(0, 'rgba(101,217,237,0.18)'); glow.addColorStop(1, 'rgba(101,217,237,0)');
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
      // The window: the whole screenshot, scaled to sit with a margin, cut off at the bottom edge like a desk.
      const scale = (W * 0.86) / image.width;
      const w = image.width * scale, h = image.height * scale;
      const x = (W - w) / 2, y = H * 0.09;
      const r = 14 * scale * 1.6;
      const shape = () => {
        c.beginPath();
        c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
      };
      c.save(); c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 60; c.shadowOffsetY = 24; c.fillStyle = '#111824'; shape(); c.fill(); c.restore();
      c.save(); shape(); c.clip(); c.imageSmoothingQuality = 'high'; c.drawImage(image, x, y, w, h); c.restore();
      c.save(); shape(); c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5; c.stroke(); c.restore();
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('the screenshot did not load'));
    image.src = ${JSON.stringify(source)};
  })`);
  return Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64');
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<html><body></body></html>');
  try {
    if (!fs.existsSync(SOURCE)) throw new Error(`missing ${path.relative(root, SOURCE)}: run npm run shots:public first`);
    for (const output of OUTPUTS) {
      const png = await compose(win, output.width, output.height);
      fs.writeFileSync(path.join(root, output.file), png);
      console.log(`${output.file} ${output.width}x${output.height} ${png.length} bytes`);
    }
  } catch (error) {
    console.error(String(error && error.message));
    process.exitCode = 1;
  }
  app.quit();
});
