/**
 * Starts a built app (a packaged bundle, an installed package, an unpacked AppImage or tar.gz) and attaches to its
 * window through the Chrome DevTools Protocol.
 *
 * Release builds have the Node inspector fuse turned off (forge.config.js), so Playwright's electron.launch, which
 * attaches through the inspector, cannot drive them. --remote-debugging-port is a Chromium switch, not a fuse: it
 * reaches the page (and its preload API), never the main process. That is all the package checks need, and it lets
 * them check the very binary people download.
 *
 * The port is 0 (the system picks a free one); Chromium writes it to <user-data-dir>/DevToolsActivePort.
 *
 * Only a port file written by this start counts (readFreshPort). Chromium leaves the file behind when the app
 * quits, and on an upgrade from 0.x the app renames the old profile folder into place at start
 * (src/main/profileAdoption.ts), so for a moment the new folder holds the previous run's file with a port nobody
 * listens on any more. Removing the file before the start cannot help there: the folder it lands in does not exist
 * yet.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

// Only upgrade preparation opts into the old loadFile renderer at its exact installed path.
function isAppPageUrl(url, legacyRendererFile) {
  return url.startsWith('app://') || (typeof legacyRendererFile === 'string' && url === pathToFileURL(legacyRendererFile).href);
}

/**
 * The port in DevToolsActivePort if the file was written at or after `startedAtMs` (the start of the app), else ''
 * (missing, still empty, or left by an earlier run). The start time is rounded down to the second, so a file system
 * that keeps whole-second times still counts a file written in the same second as fresh.
 */
function readFreshPort(portFile, startedAtMs, fsImpl = fs) {
  let stat;
  let text;
  try {
    stat = fsImpl.statSync(portFile);
    text = String(fsImpl.readFileSync(portFile, 'utf8'));
  } catch {
    return '';
  }
  if (stat.mtimeMs < Math.floor(startedAtMs / 1000) * 1000) return '';
  const port = text.split('\n')[0].trim();
  return /^\d+$/.test(port) ? port : '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} options
 * @param {string} options.executable  the program to start
 * @param {string[]} [options.args]     extra arguments (e.g. --user-data-dir=…)
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} options.userData     the profile folder the app will use (where DevToolsActivePort appears)
 * @param {string} [options.legacyRendererFile] exact old installed renderer, for upgrade preparation only
 * @param {number} [options.timeout]    milliseconds to wait for the window
 */
async function launchOverCdp({ executable, args = [], env = process.env, userData, timeout = 90000, legacyRendererFile }) {
  const portFile = path.join(userData, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });
  // Root (a container) needs --no-sandbox; a normal user keeps the sandbox.
  const sandbox = process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [];
  const startedAt = Date.now();
  const child = spawn(executable, [...sandbox, ...args, '--remote-debugging-port=0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const keep = (chunk) => {
    output = (output + chunk.toString()).slice(-4000);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let exited = null;
  child.on('exit', (code, signal) => {
    exited = { code, signal };
  });

  const deadline = Date.now() + timeout;
  let port = '';
  while (!port) {
    if (exited) throw new Error(`APP_EXITED ${JSON.stringify(exited)} before its window opened:\n${output}`);
    if (Date.now() > deadline) throw new Error(`APP_NO_DEBUG_PORT after ${timeout} ms:\n${output}`);
    port = readFreshPort(portFile, startedAt);
    if (!port) await sleep(250);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout });
  let window = null;
  while (!window) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    window = pages.find((page) => isAppPageUrl(page.url(), legacyRendererFile)) ?? null;
    if (window) break;
    if (Date.now() > deadline) throw new Error(`APP_NO_WINDOW pages=${JSON.stringify(pages.map((page) => page.url()))}\n${output}`);
    await sleep(250);
  }

  async function close() {
    await browser.close().catch(() => undefined);
    if (!exited) {
      child.kill('SIGTERM');
      for (let i = 0; i < 40 && !exited; i++) await sleep(250);
      if (!exited) child.kill('SIGKILL');
    }
  }

  return { child, window, browser, close, output: () => output };
}

module.exports = { launchOverCdp, isAppPageUrl, readFreshPort };
