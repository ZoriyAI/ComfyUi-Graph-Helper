import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Electron desktop smoke test
 * Launches full production app with built renderer, verifies UI loads
 */

test('Desktop smoke: app window loads with production renderer', async () => {
  console.log('[SMOKE] Starting Electron app');

  // Launch Electron with production main.js
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  // Get main window
  const window = await electronApp.firstWindow();
  console.log('[SMOKE] Window opened');

  // Wait for app to load
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000); // Let React render

  // Verify title
  const title = await window.title();
  console.log('[SMOKE] Window title:', title);
  expect(title).toContain('ComfyUI');

  // Verify main elements exist
  const graphCanvas = await window.locator('[data-testid="graph-canvas"], .react-flow').count();
  const chatPanel = await window.locator('text=Chat').count();

  console.log('[SMOKE] Graph canvas elements:', graphCanvas);
  console.log('[SMOKE] Chat panel elements:', chatPanel);

  expect(graphCanvas).toBeGreaterThan(0);
  expect(chatPanel).toBeGreaterThan(0);

  // Take screenshot
  const screenshotPath = '/opt/cursor/artifacts/desktop-smoke.png';
  await window.screenshot({ path: screenshotPath, fullPage: true });
  console.log('[SMOKE] Screenshot saved:', screenshotPath);

  // Check console for critical errors
  const logs: string[] = [];
  window.on('console', (msg) => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('Error') || text.includes('Failed')) {
      console.log('[SMOKE] Console:', text);
    }
  });

  await window.waitForTimeout(500);

  // Verify no critical renderer errors
  const criticalErrors = logs.filter((l) =>
    l.toLowerCase().includes('uncaught') || l.toLowerCase().includes('failed to fetch')
  );
  expect(criticalErrors).toHaveLength(0);

  await electronApp.close();
  console.log('[SMOKE] ✓ Desktop smoke passed');
});

test('Desktop smoke: disconnected mode screenshot', async () => {
  console.log('[SMOKE] Taking disconnected mode screenshot');

  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);

  // Take screenshot of default disconnected state
  const screenshotPath = '/opt/cursor/artifacts/desktop-disconnected.png';
  await window.screenshot({ path: screenshotPath, fullPage: true });
  console.log('[SMOKE] Disconnected mode screenshot:', screenshotPath);

  await electronApp.close();
  console.log('[SMOKE] ✓ Disconnected mode captured');
});
