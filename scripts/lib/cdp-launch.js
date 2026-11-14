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
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} options
 * @param {string} options.executable  the program to start
 * @param {string[]} [options.args]     extra arguments (e.g. --user-data-dir=…)
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} options.userData     the profile folder the app will use (where DevToolsActivePort appears)
 * @param {number} [options.timeout]    milliseconds to wait for the window
 */
async function launchOverCdp({ executable, args = [], env = process.env, userData, timeout = 90000 }) {
  const portFile = path.join(userData, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });
  // Root (a container) needs --no-sandbox; a normal user keeps the sandbox.
  const sandbox = process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [];
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
    try {
      port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    } catch {
      await sleep(250);
    }
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout });
  let window = null;
  while (!window) {
    window = browser.contexts().flatMap((context) => context.pages()).find((page) => page.url().startsWith('app://')) ?? null;
    if (window) break;
    if (Date.now() > deadline) throw new Error('APP_NO_WINDOW');
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

module.exports = { launchOverCdp };
