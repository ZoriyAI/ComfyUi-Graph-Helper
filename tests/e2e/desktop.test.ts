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

  // Verify preload API is available
  const apiStatus = await window.evaluate(() => {
    const api = (window as any).electronAPI;
    return {
      available: !!api,
      platform: api?.platform || 'N/A',
      electron: api?.versions?.electron || 'N/A',
    };
  });

  console.log('[SMOKE] electronAPI status:', apiStatus);
  expect(apiStatus.available).toBe(true);
  expect(apiStatus.platform).not.toBe('N/A');
  expect(apiStatus.electron).not.toBe('N/A');

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

test('Desktop smoke: TEST fixture IPC chat interaction', async () => {
  console.log('[SMOKE] Starting TEST fixture mode');

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

  // Configure TEST provider via electronAPI
  console.log('[SMOKE] Configuring TEST fixture via IPC');
  await window.evaluate(async () => {
    const api = (window as any).electronAPI;
    await api.llmSetConfig({
      provider: 'test',
      model: 'test-fixture',
    });
    console.log('[TEST MODE] Test fixture configured via IPC');
  });

  // Wait for config to propagate
  await window.waitForTimeout(500);

  // Send chat message via UI
  console.log('[SMOKE] Sending chat message via UI');
  const messageInput = window.locator('input[type="text"]').first();
  await messageInput.fill('Add a test node');
  await messageInput.press('Enter');

  // Wait for AI operations to complete
  await window.waitForTimeout(4000);

  // Verify nodes added to canvas
  const result = await window.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node');
    const toolStatuses = document.querySelectorAll('[data-tool-status]');
    return {
      nodeCount: nodes.length,
      toolStatusCount: toolStatuses.length,
      hasNodes: nodes.length > 0,
    };
  });

  console.log('[SMOKE] Graph result:', result);
  expect(result.hasNodes).toBe(true);
  expect(result.nodeCount).toBeGreaterThan(0);

  // Take screenshot of test mode with nodes
  const screenshotPath = '/opt/cursor/artifacts/desktop-test-fixture.png';
  await window.screenshot({ path: screenshotPath, fullPage: true });
  console.log('[SMOKE] TEST fixture screenshot:', screenshotPath);

  await electronApp.close();
  console.log('[SMOKE] ✓ TEST fixture IPC interaction verified');
});
