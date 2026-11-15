/**
 * What the layout audit needs to know about this app: which parts are a canvas a person pans, which stick out on
 * purpose, and where an ellipsis is the design. Used by the walk over every screen (layout-walk.test.ts) and by
 * tests that reach a state the walk cannot (a notice from a live model, a paused run): node-card, model-card,
 * lessons, step-checkpoint and local-context-window.
 */
import { expect, type Page } from '@playwright/test';
import { auditLayout, describeIssues, type AuditOptions, type LayoutIssue } from './layoutAudit';
import { en } from '../../src/shared/i18n/catalog';

/** The audit options for the whole app window. */
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
    // The data type beside a port is a hint, named by the pack that made it (WANVIDIMAGE_CLIPEMBEDS); the port's
    // name stays whole, and the full type is in the tooltip.
    '.port-type[title]',
    // The class under a node's title is the pack's own identifier (WanVideoImageToVideoMultiTalk); the title above
    // names the node, and the full class is in the tooltip.
    '.graph-node-type[title]',
  ],
  // Every text and tooltip is read for "{{count}}", "undefined" and translation keys shown instead of their text.
  keyRoots: Object.keys(en),
  // What the person typed and what the model answered is theirs, whatever it says.
  ownWords: ['.chat-words'],
};

/**
 * What travels with a node on the canvas is where the node is and as large as the node looks, at any zoom: a
 * description card sits on its side of its node, as wide as the node (within the card's limits), drawn at the
 * canvas zoom, and lies on no other node unless the person asked for it. The numbers are the card's own
 * (lib/description.ts): gaps of 8 and 14, widths from 220 to 420, drawn at 0.55 to 1.25 of its size.
 * And no node lies on another: in the walk every node is where the app put it.
 */
export async function attachmentIssues(page: Page): Promise<LayoutIssue[]> {
  return page.evaluate(async () => {
    const issues: Array<{ kind: 'detached' | 'overlap'; where: string; text: string; detail: string }> = [];
    if (document.querySelector('[data-zoom="overview"]')) return issues;
    // A node that is still arriving (it grows into place for a third of a second) is not where it will be; the
    // places are compared once what moves on the canvas has come to rest. Pulses that never end are not waited for.
    const arriving = document.getAnimations().filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const timing = animation.effect?.getComputedTiming();
      return animation.playState === 'running' && timing?.iterations !== Infinity
        && target instanceof Element && target.closest('.react-flow__node, .description-scale, [data-ghost]') !== null;
    });
    if (arriving.length > 0) {
      await Promise.race([
        Promise.all(arriving.map((animation) => animation.finished.catch(() => undefined))),
        new Promise((resolve) => { setTimeout(resolve, 1500); }),
      ]);
      await new Promise((resolve) => { requestAnimationFrame(() => resolve(undefined)); });
    }
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')).map((el) => ({
      id: el.getAttribute('data-id') ?? '',
      rect: el.getBoundingClientRect(),
      width: (el as HTMLElement).offsetWidth,
      name: (el.querySelector('.graph-node-title')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 60),
    }));
    // Every node here was put where it is by the app (added, arranged, built): none lies on another.
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const x = Math.min(nodes[a].rect.right, nodes[b].rect.right) - Math.max(nodes[a].rect.left, nodes[b].rect.left);
        const y = Math.min(nodes[a].rect.bottom, nodes[b].rect.bottom) - Math.max(nodes[a].rect.top, nodes[b].rect.top);
        if (x > 3 && y > 3) issues.push({ kind: 'overlap', where: 'node', text: nodes[a].name, detail: `lies on the node "${nodes[b].name}" by ${Math.round(x)}×${Math.round(y)}px` });
      }
    }
    const zoomMatch = /scale\(([\d.]+)\)/.exec((document.querySelector('.react-flow__viewport') as HTMLElement | null)?.style.transform ?? '');
    const zoom = zoomMatch ? Number(zoomMatch[1]) : 1;
    // A suggested node is drawn where it will land, and that is on no node.
    for (const ghost of Array.from(document.querySelectorAll<HTMLElement>('[data-ghost-kind="add-node"], [data-ghost-kind="insert-subgraph"]'))) {
      const rect = ghost.getBoundingClientRect();
      const text = (ghost.querySelector('.graph-node-title')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 60);
      for (const other of nodes) {
        const x = Math.min(rect.right, other.rect.right) - Math.max(rect.left, other.rect.left);
        const y = Math.min(rect.bottom, other.rect.bottom) - Math.max(rect.top, other.rect.top);
        if (x > 3 && y > 3) issues.push({ kind: 'overlap', where: 'suggested node', text, detail: `lies on the node "${other.name}" by ${Math.round(x)}×${Math.round(y)}px` });
      }
    }
    // What the helper is saying now (the bubble of a build step, the callout of a tour step, the words beside a
    // port that say where a link would go) is read whole: nothing else that hangs on a node lies on it.
    for (const bubble of Array.from(document.querySelectorAll<HTMLElement>('[data-build-callout], [data-tour-step], .connect-hint'))) {
      const rect = bubble.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      const text = (bubble.innerText ?? '').replace(/\s+/g, ' ').slice(0, 60);
      const seen = new Set<Element>();
      for (let row = 1; row <= 5; row += 1) {
        for (let column = 1; column <= 7; column += 1) {
          const hit = document.elementFromPoint(rect.left + (rect.width * column) / 8, rect.top + (rect.height * row) / 6);
          if (!hit || bubble.contains(hit)) continue;
          const over = hit.closest('.description-card, .react-flow__node, [data-ghost]');
          if (!over || seen.has(over)) continue;
          seen.add(over);
          const what = over.matches('.description-card') ? 'a description card' : over.matches('[data-ghost]') ? 'a suggested node' : 'a node';
          issues.push({ kind: 'overlap', where: bubble.matches('.connect-hint') ? 'the hint at a port' : 'the bubble of the helper', text, detail: `is covered by ${what}: "${((over as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').slice(0, 40)}"` });
        }
      }
    }
    for (const card of Array.from(document.querySelectorAll<HTMLElement>('.description-card'))) {
      const id = card.getAttribute('data-description-node') ?? '';
      const node = nodes.find((item) => item.id === id);
      if (!node) continue;
      const side = card.getAttribute('data-side') ?? 'bottom';
      const text = (card.innerText ?? '').replace(/\s+/g, ' ').slice(0, 60);
      const rect = card.getBoundingClientRect();
      const scale = Number(card.parentElement?.getAttribute('data-card-scale') ?? '1');
      const asked = card.getAttribute('data-asked') === 'true';
      // Drawn at the canvas zoom between its limits; asked for, never smaller than readable.
      const natural = Math.min(1.25, Math.max(0.55, zoom));
      const expected = asked ? Math.max(natural, 0.9) : natural;
      if (Math.abs(scale - expected) > 0.02) issues.push({ kind: 'detached', where: 'description card', text, detail: `drawn at ${scale} of its size at a canvas zoom of ${Math.round(zoom * 100) / 100}; ${Math.round(expected * 100) / 100} expected` });
      if (Math.abs(rect.width - card.offsetWidth * scale) > 2) issues.push({ kind: 'detached', where: 'description card', text, detail: `${Math.round(rect.width)}px wide on screen where ${Math.round(card.offsetWidth * scale)}px were expected` });
      // As wide as its node, within the card's own limits (a one-line card of a crowded node is a little narrower).
      const squeezed = card.getAttribute('data-squeezed') === 'true';
      const own = squeezed ? Math.min(Math.max(96, node.width - 18), Math.min(420, Math.max(220, node.width))) : Math.min(420, Math.max(220, node.width));
      if (Math.abs(card.offsetWidth - own) > 2) issues.push({ kind: 'detached', where: 'description card', text, detail: `${card.offsetWidth}px wide in its own pixels beside a node of ${node.width}px; ${own}px expected` });
      // On its side of the node, at the gap, centred or top-aligned.
      const gap = (side === 'bottom' || side === 'top' ? 8 : 14) * scale;
      const centre = Math.abs((rect.left + rect.right) / 2 - (node.rect.left + node.rect.right) / 2);
      const off = side === 'bottom' ? Math.max(Math.abs(rect.top - (node.rect.bottom + gap)), centre)
        : side === 'top' ? Math.max(Math.abs(rect.bottom - (node.rect.top - gap)), centre)
          : side === 'right' ? Math.max(Math.abs(rect.left - (node.rect.right + gap)), Math.abs(rect.top - node.rect.top))
            : Math.max(Math.abs(rect.right - (node.rect.left - gap)), Math.abs(rect.top - node.rect.top));
      if (off > 3) issues.push({ kind: 'detached', where: 'description card', text, detail: `${Math.round(off)}px away from its place on the ${side} side of its node` });
      // On no other node, unless the person asked for this card (then it is drawn over).
      if (!asked) {
        for (const other of nodes) {
          if (other.id === id) continue;
          const x = Math.min(rect.right, other.rect.right) - Math.max(rect.left, other.rect.left);
          const y = Math.min(rect.bottom, other.rect.bottom) - Math.max(rect.top, other.rect.top);
          if (x > 3 && y > 3) issues.push({ kind: 'overlap', where: 'description card', text, detail: `lies on another node by ${Math.round(x)}×${Math.round(y)}px` });
        }
      }
    }
    return issues;
  });
}

/** A window size in CSS pixels. */
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
