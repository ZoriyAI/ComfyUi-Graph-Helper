const { _electron: electron } = require('@playwright/test');
const path = require('path');

(async () => {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, 'dist/main/index.js')],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);

  await window.evaluate(async () => {
    await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture' });
  });

  await window.waitForTimeout(1000);

  const input = window.locator('input[type="text"]').first();
  await input.fill('Add a test node');
  await input.press('Enter');

  console.log('Waiting 15 seconds...');
  await window.waitForTimeout(15000);

  const dom = await window.evaluate(() => {
    // Try various selectors
    const all = document.querySelectorAll('*');
    const withMessage = Array.from(all).filter(el => 
      (typeof el.className === 'string' && el.className.toLowerCase().includes('message')) ||
      el.textContent?.includes('added') ||
      el.textContent?.includes('annotated')
    );
    
    return {
      messageElements: withMessage.length,
      samples: withMessage.slice(0, 3).map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.substring(0, 100)
      })),
      chatPanelHTML: document.querySelector('[class*="Chat"]')?.innerHTML?.substring(0, 500) || 'not found'
    };
  });

  console.log('DOM check:', JSON.stringify(dom, null, 2));

  await window.screenshot({ path: '/opt/cursor/artifacts/dom-check.png', fullPage: true });
  await electronApp.close();
})();
