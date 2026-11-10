import { expect, type Page } from '@playwright/test';
import { auditLayout, describeIssues, type AuditOptions } from './layoutAudit';
import { en } from '../../src/shared/i18n/catalog';

/**
 * What the layout audit needs to know about this app: which parts are a canvas a person pans, which stick out on
 * purpose, and where an ellipsis is the design. Used by the walk over every screen (layout-walk.test.ts) and by
 * tests that reach a state the walk cannot (a notice from a live model, a paused run).
 */
export const APP_AUDIT: AuditOptions = {
  ignore: ['.react-flow__minimap', '.react-flow__attribution', '.react-flow__edges', '.react-flow__background', '.react-flow__edgelabel-renderer', '.react-flow__connectionline'],
  islands: ['.react-flow__viewport'],
  units: ['.react-flow__node', '.react-flow__node-toolbar', '[data-ghost]', '[data-group-id]'],
  // The port dots sit on a node's edge, half outside it.
  overhang: ['.react-flow__handle'],
  shortened: true,
  shortenedOk: [
    // One-line previews that open in full on a click.
    '.description-card', '[class*="_snippet_"]',
    // Names the person brought: a file on a node, a file or a node class in the library, the helper's model,
    // a value picked in a settings list, a file in a field's list, the project, a node's title.
    '.node-fields', '#model-library-list', '#node-library-list', '.helper-select', '.select-trigger:not([data-value=""])',
    '[role="listbox"] [role="option"]', '[role="dialog"] [role="option"]', '.project-chip', '.graph-node-title',
    // The build strip: the step counter comes first and stays whole; the reason after it is in the bubble by the node.
    '[data-live-build]',
  ],
  // Every text and tooltip is read for "{{count}}", "undefined" and translation keys shown instead of their text.
  keyRoots: Object.keys(en),
  // What the person typed and what the model answered is theirs, whatever it says.
  ownWords: ['.chat-words'],
};

export interface Size { width: number; height: number }

/** The smallest window the app allows and the size it opens at. */
export const KEY_SIZES: Size[] = [{ width: 800, height: 560 }, { width: 1400, height: 860 }];

/**
 * The page as it is now, looked at in the smallest window and in the usual one: nothing sticks out, is cut,
 * leaves the window or lies on something else. The window returns to the size it had.
 */
export async function expectSoundLayout(page: Page, label: string, sizes: Size[] = KEY_SIZES): Promise<void> {
  const before = page.viewportSize();
  const faults: string[] = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(320);
    const issues = await auditLayout(page, APP_AUDIT);
    if (issues.length > 0) faults.push(`${label} @ ${size.width}x${size.height}\n${describeIssues(issues)}`);
  }
  if (before) {
    await page.setViewportSize(before);
    await page.waitForTimeout(200);
  }
  expect(faults.join('\n'), `layout of: ${label}`).toBe('');
}
