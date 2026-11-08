import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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
  const chatPanel = await window.locator('text=Assistant').count();

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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-fixture-'));

  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
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
  await window.waitForTimeout(1000);

  // Send chat message via UI
  console.log('[SMOKE] Sending chat message via UI');
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const messageInput = window.locator('textarea[aria-label="Chat message"]');
  await messageInput.fill('Add a test node');
  await messageInput.press('Enter');

  // Wait for AI operations to complete
  await window.waitForTimeout(8000);

  // Get initial state before sending message
  const initialState = await window.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    const nodeIds = nodes.map((n: any) => {
      const titleEl = n.querySelector('[class*="title"]') || n;
      return { id: n.dataset.id, text: titleEl.textContent };
    });
    return {
      initialNodeCount: nodes.length,
      initialNodeIds: nodeIds,
    };
  });

  console.log('[SMOKE] Initial state:', initialState);

  // Wait for ALL AI operations to complete:
  // - addNode tool call + result
  // - annotateNode tool call + result  
  // - final text completion
  // - streaming stops
  console.log('[SMOKE] Waiting for completion (15 seconds)...');
  await window.waitForTimeout(15000);

  // Verify complete final state
  const finalState = await window.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    const newNodes = nodes.filter((n: any) => 
      n.textContent?.includes('AI Test Node') || n.textContent?.includes('TestNode')
    );
    
    // Check if input is enabled (not streaming)
    const input = document.querySelector('textarea[aria-label="Chat message"]') as HTMLTextAreaElement;
    const inputEnabled = input && !input.disabled;
    
    // Check for AI Test Node specifically (not initial samples)
    const aiTestNode = nodes.find((n: any) => n.textContent?.includes('AI Test Node'));
    
    return {
      finalNodeCount: nodes.length,
      newNodeCount: newNodes.length,
      hasNewNode: !!aiTestNode,
      newNodeText: aiTestNode?.textContent || '',
      inputEnabled,
    };
  });

  console.log('[SMOKE] Final state:', finalState);
  
  // Verify:
  // 1. NEW "AI Test Node" added via chat
  expect(finalState.hasNewNode).toBe(true);
  expect(finalState.newNodeText).toContain('AI Test Node');
  
  // 2. Input enabled (streaming finished)
  expect(finalState.inputEnabled).toBe(true);

  // Take screenshot of test mode with nodes
  const screenshotPath = '/opt/cursor/artifacts/desktop-test-fixture.png';
  await window.screenshot({ path: screenshotPath, fullPage: true });
  console.log('[SMOKE] TEST fixture screenshot:', screenshotPath);

  await electronApp.close();
  console.log('[SMOKE] ✓ TEST fixture IPC interaction verified');
});
