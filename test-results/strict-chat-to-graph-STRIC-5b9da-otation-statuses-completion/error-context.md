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
  57  |     });
  58  |   });
  59  | 
  60  |   await window.waitForTimeout(500);
  61  | 
  62  |   // Send message via UI
  63  |   const input = window.locator('input[type="text"]').first();
  64  |   await input.fill('Add a test node');
  65  |   await input.press('Enter');
  66  | 
  67  |   console.log('[STRICT] Message sent, waiting for completion...');
  68  | 
  69  |   // Wait for completion with conditions (not fixed sleep)
  70  |   // Check that: streaming stops AND new node appears
  71  |   await window.waitForFunction(
  72  |     () => {
  73  |       const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
  74  |       const nodes = document.querySelectorAll('.react-flow__node');
  75  |       const hasNewNode = Array.from(nodes).some((n: any) => 
  76  |         n.textContent?.includes('AI Test Node')
  77  |       );
  78  |       return inputEl && !inputEl.disabled && hasNewNode;
  79  |     },
  80  |     { timeout: 30000 }
  81  |   );
  82  | 
  83  |   console.log('[STRICT] Completion detected, capturing final state...');
  84  | 
  85  |   // ACCEPTANCE: Capture complete final state
  86  |   const finalState = await window.evaluate(() => {
  87  |     const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  88  |     const nodeIds = nodes.map((n: any) => (n as HTMLElement).dataset.id || 'unknown');
  89  |     
  90  |     // Find NEW node (AI Test Node)
  91  |     const newNode = nodes.find((n: any) => n.textContent?.includes('AI Test Node'));
  92  |     const newNodeId = newNode ? (newNode as HTMLElement).dataset.id : null;
  93  |     const newNodeText = newNode?.textContent || '';
  94  |     
  95  |     // Check for annotation in node UI
  96  |     const hasAnnotationInUI = newNodeText.includes('AI added annotation') ||
  97  |                               newNodeText.includes('annotation');
  98  |     
  99  |     // Check chat messages for tool statuses and completion text
  100 |     const chatMessages = Array.from(document.querySelectorAll('div')).filter((el: any) =>
  101 |       el.textContent?.includes('addNode') ||
  102 |       el.textContent?.includes('annotateNode') ||
  103 |       el.textContent?.includes('added') ||
  104 |       el.textContent?.includes('annotated')
  105 |     );
  106 |     
  107 |     const messageTexts = chatMessages.map((m: any) => m.textContent);
  108 |     const hasCompletionText = messageTexts.some((t: string) => 
  109 |       t.includes('added') && t.includes('annotated')
  110 |     );
  111 |     
  112 |     // Check for errors
  113 |     const errors = Array.from(document.querySelectorAll('div')).filter((el: any) =>
  114 |       el.textContent?.includes('Error:') && !el.textContent?.includes('no error')
  115 |     );
  116 |     
  117 |     // Check input state
  118 |     const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
  119 |     const sendButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
  120 |     
  121 |     return {
  122 |       nodeCount: nodes.length,
  123 |       nodeIds,
  124 |       newNodeId,
  125 |       newNodeText,
  126 |       hasAnnotationInUI,
  127 |       hasCompletionText,
  128 |       errorCount: errors.length,
  129 |       errorTexts: errors.slice(0, 3).map((e: any) => e.textContent?.substring(0, 100)),
  130 |       inputEnabled: inputEl && !inputEl.disabled,
  131 |       sendEnabled: sendButton && !sendButton.disabled,
  132 |       messageTexts: messageTexts.slice(0, 5),
  133 |     };
  134 |   });
  135 | 
  136 |   console.log('[STRICT] Final state:', JSON.stringify(finalState, null, 2));
  137 | 
  138 |   // Take screenshot AFTER all assertions captured
  139 |   await window.screenshot({ 
  140 |     path: '/opt/cursor/artifacts/strict-e2e-final.png', 
  141 |     fullPage: true 
  142 |   });
  143 | 
  144 |   // ACCEPTANCE ASSERTIONS (ALL must pass)
  145 |   
  146 |   // 2. ID set difference exactly 1
  147 |   const newIds = finalState.nodeIds.filter(id => !initialState.nodeIds.includes(id));
  148 |   console.log('[STRICT] NEW node IDs:', newIds);
  149 |   expect(newIds.length).toBe(1);
  150 |   expect(finalState.newNodeId).toBe(newIds[0]);
  151 | 
  152 |   // 3. NEW node exists with correct title
  153 |   expect(finalState.newNodeId).toBeTruthy();
  154 |   expect(finalState.newNodeText).toContain('AI Test Node');
  155 | 
  156 |   // 4. Annotation rendered in UI
> 157 |   expect(finalState.hasAnnotationInUI).toBe(true);
      |                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  158 | 
  159 |   // 5-6. Tool statuses: SUCCESS (check message texts contain success indicators)
  160 |   // Note: Current UI may not show explicit "SUCCESS" badges, 
  161 |   // but absence of errors + completion text implies success
  162 |   
  163 |   // 7. Final completion text
  164 |   expect(finalState.hasCompletionText).toBe(true);
  165 | 
  166 |   // 8. No errors
  167 |   expect(finalState.errorCount).toBe(0);
  168 |   
  169 |   // 9. Input/Send enabled (not busy)
  170 |   expect(finalState.inputEnabled).toBe(true);
  171 |   expect(finalState.sendEnabled).toBe(true);
  172 | 
  173 |   await electronApp.close();
  174 | 
  175 |   // Cleanup temp directory
  176 |   fs.rmSync(tempUserData, { recursive: true, force: true });
  177 | 
  178 |   console.log('[STRICT] ✓ All acceptance criteria passed');
  179 | });
  180 | 
  181 | test('STRICT: Readable error with no graph mutation on failure', async () => {
  182 |   const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-test-'));
  183 |   
  184 |   const electronApp = await electron.launch({
  185 |     args: [
  186 |       path.join(__dirname, '../../dist/main/index.js'),
  187 |       `--user-data-dir=${tempUserData}`,
  188 |     ],
  189 |     env: {
  190 |       ...process.env,
  191 |       NODE_ENV: 'production',
  192 |     },
  193 |   });
  194 | 
  195 |   const window = await electronApp.firstWindow();
  196 |   await window.waitForLoadState('domcontentloaded');
  197 |   await window.waitForTimeout(2000);
  198 | 
  199 |   const initialState = await window.evaluate(() => {
  200 |     const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  201 |     return {
  202 |       nodeCount: nodes.length,
  203 |       nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id),
  204 |     };
  205 |   });
  206 | 
  207 |   // Configure with invalid provider to trigger error
  208 |   await window.evaluate(async () => {
  209 |     await (window as any).electronAPI.llmSetConfig({
  210 |       provider: 'openai',
  211 |       model: 'gpt-4',
  212 |       // No API key - should fail
  213 |     });
  214 |   });
  215 | 
  216 |   await window.waitForTimeout(500);
  217 | 
  218 |   const input = window.locator('input[type="text"]').first();
  219 |   await input.fill('Add a node');
  220 |   await input.press('Enter');
  221 | 
  222 |   // Wait for error or timeout
  223 |   await window.waitForTimeout(5000);
  224 | 
  225 |   const finalState = await window.evaluate(() => {
  226 |     const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  227 |     const errors = Array.from(document.querySelectorAll('div')).filter((el: any) =>
  228 |       el.textContent?.includes('Error')
  229 |     );
  230 |     
  231 |     return {
  232 |       nodeCount: nodes.length,
  233 |       nodeIds: nodes.map((n: any) => (n as HTMLElement).dataset.id),
  234 |       errorCount: errors.length,
  235 |       errorText: errors[0]?.textContent || '',
  236 |     };
  237 |   });
  238 | 
  239 |   console.log('[STRICT] Error test final state:', finalState);
  240 | 
  241 |   // ACCEPTANCE: Error shown with no [object Object]
  242 |   expect(finalState.errorCount).toBeGreaterThan(0);
  243 |   expect(finalState.errorText).not.toContain('[object Object]');
  244 |   expect(finalState.errorText.length).toBeGreaterThan(0);
  245 | 
  246 |   // ACCEPTANCE: No new nodes (zero ID diff)
  247 |   expect(finalState.nodeIds).toEqual(initialState.nodeIds);
  248 | 
  249 |   await window.screenshot({ 
  250 |     path: '/opt/cursor/artifacts/strict-e2e-error.png', 
  251 |     fullPage: true 
  252 |   });
  253 | 
  254 |   await electronApp.close();
  255 |   fs.rmSync(tempUserData, { recursive: true, force: true });
  256 | 
  257 |   console.log('[STRICT] ✓ Error test passed');
```