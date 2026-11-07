const { _electron: electron } = require('@playwright/test');
const path = require('path');

(async () => {
  console.log('[Manual] Starting Electron');
  
  const electronApp = await electron.launch({
    args: [path.join(__dirname, 'dist/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);

  console.log('[Manual] Configuring TEST fixture');
  await window.evaluate(async () => {
    const api = window.electronAPI;
    await api.llmSetConfig({
      provider: 'test',
      model: 'test-fixture',
    });
    console.log('[TEST MODE] Configured');
  });

  await window.waitForTimeout(1000);

  console.log('[Manual] Sending chat message');
  const input = window.locator('input[type="text"]').first();
  await input.fill('Add a test node');
  await input.press('Enter');

  console.log('[Manual] Waiting 10 seconds...');
  await window.waitForTimeout(10000);

  const result = await window.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node');
    const chatMessages = document.querySelectorAll('div').length;
    
    return {
      nodeCount: nodes.length,
      domElementCount: chatMessages,
    };
  });

  console.log('[Manual] Result:', result);

  await window.screenshot({ path: '/opt/cursor/artifacts/manual-test.png', fullPage: true });
  console.log('[Manual] Screenshot saved');

  await window.waitForTimeout(5000);
  await electronApp.close();
})();
