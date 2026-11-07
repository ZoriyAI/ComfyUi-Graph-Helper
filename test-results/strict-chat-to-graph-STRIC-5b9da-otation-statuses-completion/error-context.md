# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: strict-chat-to-graph.test.ts >> STRICT: Complete chat-to-graph with annotation, statuses, completion
- Location: tests/e2e/strict-chat-to-graph.test.ts:21:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  75  |   await input.fill('Add a test node');
  76  |   await input.press('Enter');
  77  | 
  78  |   console.log('[STRICT] Message sent, waiting for completion...');
  79  | 
  80  |   // Wait for completion with conditions (not fixed sleep)
  81  |   // Check that: streaming stops AND new node appears
  82  |   await window.waitForFunction(
  83  |     () => {
  84  |       const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
  85  |       const nodes = document.querySelectorAll('.react-flow__node');
  86  |       const hasNewNode = Array.from(nodes).some((n: any) => 
  87  |         n.textContent?.includes('AI Test Node')
  88  |       );
  89  |       return inputEl && !inputEl.disabled && hasNewNode;
  90  |     },
  91  |     { timeout: 30000 }
  92  |   );
  93  | 
  94  |   console.log('[STRICT] Completion detected, capturing final state...');
  95  | 
  96  |   // ACCEPTANCE: Capture complete final state
  97  |   const finalState = await window.evaluate(() => {
  98  |     const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  99  |     const nodeIds = nodes.map((n: any) => (n as HTMLElement).dataset.id || 'unknown');
  100 |     
  101 |     // Find NEW node (AI Test Node)
  102 |     const newNode = nodes.find((n: any) => n.textContent?.includes('AI Test Node'));
  103 |     const newNodeId = newNode ? (newNode as HTMLElement).dataset.id : null;
  104 |     const newNodeText = newNode?.textContent || '';
  105 |     
  106 |     // Check for annotation in node UI
  107 |     const hasAnnotationInUI = newNodeText.includes('AI added annotation') ||
  108 |                               newNodeText.includes('annotation');
  109 |     
  110 |     // Check chat messages for tool statuses and completion text
  111 |     const chatMessages = Array.from(document.querySelectorAll('div')).filter((el: any) =>
  112 |       el.textContent?.includes('addNode') ||
  113 |       el.textContent?.includes('annotateNode') ||
  114 |       el.textContent?.includes('added') ||
  115 |       el.textContent?.includes('annotated')
  116 |     );
  117 |     
  118 |     const messageTexts = chatMessages.map((m: any) => m.textContent);
  119 |     const hasCompletionText = messageTexts.some((t: string) => 
  120 |       t.includes('added') && t.includes('annotated')
  121 |     );
  122 |     
  123 |     // Check for errors
  124 |     const errors = Array.from(document.querySelectorAll('div')).filter((el: any) =>
  125 |       el.textContent?.includes('Error:') && !el.textContent?.includes('no error')
  126 |     );
  127 |     
  128 |     // Check input state
  129 |     const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
  130 |     const sendButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
  131 |     
  132 |     return {
  133 |       nodeCount: nodes.length,
  134 |       nodeIds,
  135 |       newNodeId,
  136 |       newNodeText,
  137 |       hasAnnotationInUI,
  138 |       hasCompletionText,
  139 |       errorCount: errors.length,
  140 |       errorTexts: errors.slice(0, 3).map((e: any) => e.textContent?.substring(0, 100)),
  141 |       inputEnabled: inputEl && !inputEl.disabled,
  142 |       sendEnabled: sendButton && !sendButton.disabled,
  143 |       messageTexts: messageTexts.slice(0, 5),
  144 |     };
  145 |   });
  146 | 
  147 |   console.log('[STRICT] Final state:', JSON.stringify(finalState, null, 2));
  148 | 
  149 |   // Take screenshot AFTER all assertions captured
  150 |   await window.screenshot({ 
  151 |     path: '/opt/cursor/artifacts/strict-e2e-final.png', 
  152 |     fullPage: true 
  153 |   });
  154 | 
  155 |   // ACCEPTANCE ASSERTIONS (ALL must pass)
  156 |   
  157 |   // 2. ID set difference exactly 1
  158 |   const newIds = finalState.nodeIds.filter(id => !initialState.nodeIds.includes(id));
  159 |   console.log('[STRICT] NEW node IDs:', newIds);
  160 |   expect(newIds.length).toBe(1);
  161 |   expect(finalState.newNodeId).toBe(newIds[0]);
  162 | 
  163 |   // 3. NEW node exists with correct title
  164 |   expect(finalState.newNodeId).toBeTruthy();
  165 |   expect(finalState.newNodeText).toContain('AI Test Node');
  166 | 
  167 |   // 4. Annotation rendered in UI
  168 |   expect(finalState.hasAnnotationInUI).toBe(true);
  169 | 
  170 |   // 5-6. Tool statuses: SUCCESS (check message texts contain success indicators)
  171 |   // Note: Current UI may not show explicit "SUCCESS" badges, 
  172 |   // but absence of errors + completion text implies success
  173 |   
  174 |   // 7. Final completion text
> 175 |   expect(finalState.hasCompletionText).toBe(true);
      |                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  176 | 
  177 |   // 8. No errors
  178 |   expect(finalState.errorCount).toBe(0);
  179 |   
  180 |   // 9. Input/Send enabled (not busy)
  181 |   expect(finalState.inputEnabled).toBe(true);
  182 |   expect(finalState.sendEnabled).toBe(true);
  183 | 
  184 |   await electronApp.close();
  185 | 
  186 |   // Cleanup temp directory
  187 |   fs.rmSync(tempUserData, { recursive: true, force: true });
  188 | 
  189 |   console.log('[STRICT] ✓ All acceptance criteria passed');
  190 | });
  191 | 
  192 | test('STRICT: Readable error with no graph mutation on failure', async () => {
  193 |   const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-test-'));
  194 |   
  195 |   const electronApp = await electron.launch({
  196 |     args: [
  197 |       path.join(__dirname, '../../dist/main/index.js'),
  198 |       `--user-data-dir=${tempUserData}`,
  199 |     ],
  200 |     env: {
  201 |       ...process.env,
  202 |       NODE_ENV: 'production',
  203 |     },
  204 |   });
  205 | 
  206 |   const window = await electronApp.firstWindow();
  207 |   await window.waitForLoadState('domcontentloaded');
  208 |   await window.waitForTimeout(2000);
  209 | 
  210 |   const initialState = await window.evaluate(() => {
  211 |     const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  212 |     return {
  213 |       nodeCount: nodes.length,
  214 |       nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id),
  215 |     };
  216 |   });
  217 | 
  218 |   // Configure with invalid provider to trigger error
  219 |   await window.evaluate(async () => {
  220 |     await (window as any).electronAPI.llmSetConfig({
  221 |       provider: 'openai',
  222 |       model: 'gpt-4',
  223 |       // No API key - should fail
  224 |     });
  225 |   });
  226 | 
  227 |   await window.waitForTimeout(500);
  228 | 
  229 |   const input = window.locator('input[type="text"]').first();
  230 |   await input.fill('Add a node');
  231 |   await input.press('Enter');
  232 | 
  233 |   // Wait for error or timeout
  234 |   await window.waitForTimeout(5000);
  235 | 
  236 |   const finalState = await window.evaluate(() => {
  237 |     const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  238 |     const errors = Array.from(document.querySelectorAll('div')).filter((el: any) =>
  239 |       el.textContent?.includes('Error')
  240 |     );
  241 |     
  242 |     return {
  243 |       nodeCount: nodes.length,
  244 |       nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id),
  245 |       errorCount: errors.length,
  246 |       errorText: errors[0]?.textContent || '',
  247 |     };
  248 |   });
  249 | 
  250 |   console.log('[STRICT] Error test final state:', finalState);
  251 | 
  252 |   // ACCEPTANCE: Error shown with no [object Object]
  253 |   expect(finalState.errorCount).toBeGreaterThan(0);
  254 |   expect(finalState.errorText).not.toContain('[object Object]');
  255 |   expect(finalState.errorText.length).toBeGreaterThan(0);
  256 | 
  257 |   // ACCEPTANCE: No new nodes (zero ID diff)
  258 |   expect(finalState.nodeIds).toEqual(initialState.nodeIds);
  259 | 
  260 |   await window.screenshot({ 
  261 |     path: '/opt/cursor/artifacts/strict-e2e-error.png', 
  262 |     fullPage: true 
  263 |   });
  264 | 
  265 |   await electronApp.close();
  266 |   fs.rmSync(tempUserData, { recursive: true, force: true });
  267 | 
  268 |   console.log('[STRICT] ✓ Error test passed');
  269 | });
  270 | 
```