import { test, expect, _electron as electron } from '@playwright/test';
import { pickOption } from './pickOption';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * STRICT E2E Chat-to-Graph Test
 * 
 * Acceptance Criteria (ALL must pass):
 * 1. Fresh isolated profile (no persisted state)
 * 2. Capture initial node IDs BEFORE config/send
 * 3. ID set difference exactly 1 after completion
 * 4. NEW node has annotation rendered in UI
 * 5. addNode tool status: SUCCESS
 * 6. annotateNode tool status: SUCCESS  
 * 7. Final assistant text contains expected completion
 * 8. No error messages
 * 9. Busy cleared: empty Send stays disabled; a nonempty draft (not sent)
 *    enables Send while the input stays enabled
 */
const EXPECTED_REPLY = 'I have added a TestNode and annotated it.';
const MAIN_LOG = '/opt/cursor/artifacts/strict-main-process.log';
const RENDERER_LOG = '/opt/cursor/artifacts/strict-renderer-console.log';

test('STRICT: Complete chat-to-graph with annotation, statuses, completion', async () => {
  // Create fresh temporary user data directory
  const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-test-'));
  console.log('[STRICT] Using fresh profile:', tempUserData);

  const consoleLogs: string[] = [];
  const mainChunks: string[] = [];
  
  const electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../../dist/main/index.js'),
      `--user-data-dir=${tempUserData}`,
    ],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  const child = electronApp.process();
  child.stdout?.on('data', (buf) => mainChunks.push(buf.toString()));
  child.stderr?.on('data', (buf) => mainChunks.push(buf.toString()));

  // Renderer console (Playwright). Main stdout/stderr is the child process above.
  electronApp.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (text.includes('[TestLLM]') || text.includes('[IPC:') || text.includes('ChatService:') || text.includes('ActionExecutor')) {
      console.log('[ELECTRON]', text);
    }
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);

  // ACCEPTANCE 1: Capture initial node IDs BEFORE any interaction
  const initialState = await window.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    return {
      nodeCount: nodes.length,
      nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id || 'unknown'),
    };
  });

  console.log('[STRICT] Initial state BEFORE config:', initialState);

  await window.screenshot({ path: '/opt/cursor/artifacts/dark-idle.png', fullPage: true });

  // Visible TEST opt-in. Not a live model and not the user's ComfyUI server.
  await pickOption(window, 'Chat provider', 'TEST fixture');
  await window.getByText('TEST fixture is on').waitFor();

  await window.getByRole('tab', { name: 'Assistant' }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('Add a test node');
  await input.press('Enter');

  console.log('[STRICT] Message sent, waiting for completion...');

  // Busy clears when the input is enabled again. Final reply is checked on its own below.
  await window.waitForFunction(
    (expectedReply) => {
      const inputEl = document.querySelector('textarea[aria-label="Chat message"]') as HTMLTextAreaElement;
      const nodes = document.querySelectorAll('.react-flow__node');
      const hasNewNode = Array.from(nodes).some((n: any) =>
        n.textContent?.includes('AI Test Node')
      );
      const pageText = document.body?.innerText || '';
      return Boolean(
        inputEl &&
          !inputEl.disabled &&
          hasNewNode &&
          pageText.includes(expectedReply)
      );
    },
    EXPECTED_REPLY,
    { timeout: 30000 }
  );

  console.log('[STRICT] Completion detected, capturing final state...');

  // ACCEPTANCE: Capture complete final state
  const finalState = await window.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    const nodeIds = nodes.map((n: any) => (n as HTMLElement).dataset.id || 'unknown');
    
    // Find NEW node (AI Test Node)
    const newNode = nodes.find((n: any) => n.textContent?.includes('AI Test Node'));
    const newNodeId = newNode ? (newNode as HTMLElement).dataset.id : null;
    const newNodeText = newNode?.textContent || '';
    
    // Check for annotation in node UI
    const hasAnnotationInUI = newNodeText.includes('AI added annotation') ||
                              newNodeText.includes('annotation');
    
    // Check chat messages for tool statuses and completion text
    const chatMessages = Array.from(document.querySelectorAll('div')).filter((el: any) =>
      el.textContent?.includes('addNode') ||
      el.textContent?.includes('annotateNode') ||
      el.textContent?.includes('added') ||
      el.textContent?.includes('annotated')
    );
    
    const messageTexts = chatMessages.map((m: any) => m.textContent || '');
    const pageText = document.body?.innerText || '';
    const hasCompletionText = pageText.includes('I have added a TestNode and annotated it.');
    const toolStatus = (name: string) =>
      document.querySelector(`[data-tool-name="${name}"]`)?.getAttribute('data-tool-status');
    const addNodeSuccess = toolStatus('addNode') === 'success';
    const annotateNodeSuccess = toolStatus('annotateNode') === 'success';
    
    // Check for errors
    const errors = Array.from(document.querySelectorAll('div')).filter((el: any) =>
      el.textContent?.includes('Error:') && !el.textContent?.includes('no error')
    );
    
    // Check input state
    const inputEl = document.querySelector('textarea[aria-label="Chat message"]') as HTMLTextAreaElement;
    const sendButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    
    return {
      nodeCount: nodes.length,
      nodeIds,
      newNodeId,
      newNodeText,
      hasAnnotationInUI,
      hasCompletionText,
      addNodeSuccess,
      annotateNodeSuccess,
      pageText,
      errorCount: errors.length,
      errorTexts: errors.slice(0, 3).map((e: any) => e.textContent?.substring(0, 100)),
      inputEnabled: inputEl && !inputEl.disabled,
      sendEnabled: sendButton && !sendButton.disabled,
      messageTexts: messageTexts.slice(0, 5),
    };
  });

  const stateForLog = { ...finalState, pageText: undefined, messageTexts: finalState.messageTexts };
  console.log('[STRICT] Final state:', JSON.stringify(stateForLog, null, 2));
  fs.writeFileSync(MAIN_LOG, mainChunks.join(''));
  fs.writeFileSync(RENDERER_LOG, consoleLogs.join('\n'));

  // ACCEPTANCE ASSERTIONS (ALL must pass)

  // 2. ID set difference exactly 1
  const newIds = finalState.nodeIds.filter(id => !initialState.nodeIds.includes(id));
  console.log('[STRICT] NEW node IDs:', newIds);
  expect(newIds.length).toBe(1);
  expect(finalState.newNodeId).toBe(newIds[0]);

  // 3. NEW node exists with correct title
  expect(finalState.newNodeId).toBeTruthy();
  expect(finalState.newNodeText).toContain('AI Test Node');

  // 4. Annotation rendered on that exact new node
  const exactNodeText = await window.locator(`[data-id="${newIds[0]}"]`).innerText();
  expect(exactNodeText).toContain('AI Test Node');
  expect(exactNodeText).toContain('AI added annotation');
  expect(finalState.hasAnnotationInUI).toBe(true);

  // 5-6. Tool statuses: SUCCESS
  expect(finalState.addNodeSuccess).toBe(true);
  expect(finalState.annotateNodeSuccess).toBe(true);

  // 7. Final assistant text, checked apart from the busy control
  expect(finalState.hasCompletionText).toBe(true);
  expect(finalState.pageText).toContain(EXPECTED_REPLY);

  // 8. No errors
  expect(finalState.errorCount).toBe(0);

  // 9. Busy cleared. Empty Send stays disabled.
  expect(finalState.inputEnabled).toBe(true);
  expect(finalState.sendEnabled).toBe(false);
  const emptyValue = await input.inputValue();
  expect(emptyValue).toBe('');

  // Nonempty next draft is NOT sent. Send becomes usable only because busy is clear.
  const draft = 'Next graph edit';
  await input.fill(draft);
  const afterDraft = await window.evaluate(() => {
    const inputEl = document.querySelector('textarea[aria-label="Chat message"]') as HTMLTextAreaElement;
    const sendButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    return {
      inputValue: inputEl?.value || '',
      inputEnabled: Boolean(inputEl && !inputEl.disabled),
      sendEnabled: Boolean(sendButton && !sendButton.disabled),
      nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id || 'unknown'),
      sentDraft: Array.from(document.querySelectorAll('div')).some((el) => {
        const text = (el.textContent || '').trim();
        return text === 'Next graph edit';
      }),
    };
  });
  expect(afterDraft.inputValue).toBe(draft);
  expect(afterDraft.sentDraft).toBe(false);
  expect(afterDraft.inputEnabled).toBe(true);
  expect(afterDraft.sendEnabled).toBe(true);
  expect(afterDraft.nodeIds).toEqual(finalState.nodeIds);

  await window.screenshot({
    path: '/opt/cursor/artifacts/strict-e2e-success.png',
    fullPage: true,
  });
  await window.screenshot({
    path: '/opt/cursor/artifacts/dark-completed.png',
    fullPage: true,
  });

  await electronApp.close();

  // Cleanup temp directory
  fs.rmSync(tempUserData, { recursive: true, force: true });

  console.log('[STRICT] ✓ All acceptance criteria passed');
});

test('STRICT: Readable error with no graph mutation on failure', async () => {
  const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-test-'));
  
  const electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../../dist/main/index.js'),
      `--user-data-dir=${tempUserData}`,
    ],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);

  const initialState = await window.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    return {
      nodeCount: nodes.length,
      nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id),
    };
  });

  await pickOption(window, 'Chat provider', 'OpenAI session');
  await window.getByText('OpenAI is selected with no key').waitFor();

  await window.getByRole('tab', { name: 'Assistant' }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('Add a node');
  await input.press('Enter');

  // Wait for error or timeout
  await window.waitForTimeout(5000);

  const finalState = await window.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    const errors = Array.from(document.querySelectorAll('div')).filter((el: any) =>
      el.textContent?.includes('Error')
    );
    
    return {
      nodeCount: nodes.length,
      nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id),
      errorCount: errors.length,
      errorText: errors[0]?.textContent || '',
    };
  });

  console.log('[STRICT] Error test final state:', finalState);

  // ACCEPTANCE: Error shown with no [object Object]
  expect(finalState.errorCount).toBeGreaterThan(0);
  expect(finalState.errorText).not.toContain('[object Object]');
  expect(finalState.errorText.length).toBeGreaterThan(0);

  // ACCEPTANCE: No new nodes (zero ID diff)
  expect(finalState.nodeIds).toEqual(initialState.nodeIds);

  await window.screenshot({ 
    path: '/opt/cursor/artifacts/strict-e2e-error.png', 
    fullPage: true 
  });

  await electronApp.close();
  fs.rmSync(tempUserData, { recursive: true, force: true });

  console.log('[STRICT] ✓ Error test passed');
});
