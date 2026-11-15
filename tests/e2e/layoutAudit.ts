/**
 * Looks at the page the way a person does and reports what sticks out: a button or a text wider than its card,
 * a control cut by the edge of its panel, a dialog or a menu that leaves the window, two controls lying on top
 * of each other, a label squeezed to nothing. It reads the laid-out page (boxes, scroll sizes, what clips what),
 * so it finds what a screenshot shows without anyone having to look at every screenshot.
 * Used through layoutProfile.ts by layout-walk and other specs, and directly by layout-audit.test.ts.
 */
import type { Page } from '@playwright/test';

/** What is wrong with an element; each kind is judged by its own rule in auditInPage. */
export type LayoutIssueKind =
  /** A part (a button, a text) is wider than the box it belongs to and shows outside it. */
  | 'spills'
  /** A part is wider or taller than its box and is cut without an ellipsis. */
  | 'cut'
  /** A panel scrolls sideways. */
  | 'scrolls-sideways'
  /** A control or a text is partly hidden by the edge of a panel that does not scroll that way. */
  | 'clipped'
  /** Something leaves the window. */
  | 'outside-window'
  /** Two controls overlap. */
  | 'overlap'
  /** A label is shortened with an ellipsis. */
  | 'shortened'
  /** A label has so little room that nothing of it can be read. */
  | 'squeezed'
  /** Words that are not words: a placeholder left in a text, "undefined", a translation key instead of its text. */
  | 'raw-text'
  /** Something that belongs to an object (a note under a node) is not where the object is, or not its size. */
  | 'detached';

/** One finding, with enough words to find the element without a screenshot. */
export interface LayoutIssue {
  kind: LayoutIssueKind;
  /** A short path to the element: tag and classes of it and two parents. */
  where: string;
  text: string;
  detail: string;
}

/** What the audit should skip or judge differently on this page; layoutProfile.ts holds the app's own set. */
export interface AuditOptions {
  /** Selectors whose subtrees are not judged (a minimap, the lines between nodes). */
  ignore?: string[];
  /**
   * Surfaces a person pans and zooms (the canvas). The surface is not a box with content that must fit: a node
   * half off the canvas is where the person left it.
   */
  islands?: string[];
  /**
   * What lies on such a surface or travels with its objects (a node card, a note attached to a node). Each is
   * judged against itself only: its parts must fit it, but the canvas edge may cut it.
   */
  units?: string[];
  /** Parts that stick out of their card on purpose (the port dots on a node's edge). */
  overhang?: string[];
  /** Also list labels shortened with an ellipsis. */
  shortened?: boolean;
  /** One-line previews that open in full, and names the person brought (file names): an ellipsis is their design. */
  shortenedOk?: string[];
  /** Judge only what is inside this element (the whole page when absent). */
  root?: string;
  /**
   * Also read every text and tooltip for what is not meant for a person: "{{count}}", "undefined", "NaN",
   * "[object Object]", or a translation key shown instead of its text. The words here are the first parts of
   * the app's translation keys ("settings", "sync"), so "settings.mcpUrl" on screen is recognised as a key.
   */
  keyRoots?: string[];
  /** Texts the person or a model wrote (a chat message, a file name): whatever they say is theirs. */
  ownWords?: string[];
}

// AuditOptions with every field filled, as plain data the page can receive.
interface PageOptions { ignore: string[]; islands: string[]; units: string[]; overhang: string[]; shortened: boolean; shortenedOk: string[]; root: string; keyRoots: string[]; ownWords: string[] }

/** Runs in the page. Kept free of closures so it can be sent as is. */
function auditInPage(options: PageOptions): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const seen = new Set<string>();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TOLERANCE = 1.5;

  const cls = (el: Element) => {
    const names = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean)
      // A CSS-module class is _name_hash_line; the name is the readable part.
      .map((name) => /^_(.+)_[A-Za-z0-9-]{3,8}_\d+$/.exec(name)?.[1] ?? name)
      .filter((name, index, all) => name && all.indexOf(name) === index)
      .slice(0, 3);
    return `${el.tagName.toLowerCase()}${names.length ? `.${names.join('.')}` : ''}`;
  };
  const where = (el: Element) => {
    const parts: string[] = [];
    let current: Element | null = el;
    for (let depth = 0; current && depth < 3; depth += 1) {
      parts.unshift(cls(current));
      current = current.parentElement;
    }
    return parts.join(' > ');
  };
  const textOf = (el: Element) => {
    const own = (el as HTMLElement).innerText ?? el.textContent ?? '';
    const label = el.getAttribute('aria-label') ?? (el as HTMLInputElement).placeholder ?? el.getAttribute('title') ?? '';
    return (own.trim() || label).replace(/\s+/g, ' ').slice(0, 70);
  };
  const report = (kind: LayoutIssueKind, el: Element, detail: string) => {
    const key = `${kind}|${where(el)}|${textOf(el)}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ kind, where: where(el), text: textOf(el), detail });
  };

  const collect = (selectors: string[]) => selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const ignored = collect(options.ignore);
  const isIgnored = (el: Element) => ignored.some((root) => root === el || root.contains(el));
  const islands = collect(options.islands);
  const units = collect(options.units);
  const overhang = collect(options.overhang);
  const isOverhang = (el: Element) => overhang.some((root) => root === el || root.contains(el));
  /** The innermost canvas object this element belongs to. */
  const unitOf = (el: Element): Element | null => {
    let found: Element | null = null;
    for (const root of units) {
      if ((root === el || root.contains(el)) && (!found || found.contains(root))) found = root;
    }
    return found;
  };
  const inIsland = (el: Element) => islands.some((root) => root === el || root.contains(el));
  // The pan surface and what holds it up to the box that clips it: their "content" is the whole canvas.
  const surfaces = new Set<Element>(islands);
  for (const root of [...islands, ...units]) {
    let current = root.parentElement;
    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      surfaces.add(current);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') break;
      current = current.parentElement;
    }
  }
  for (const root of units) surfaces.delete(root);

  const styleOf = (el: Element) => getComputedStyle(el);
  const shown = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    // Text for screen readers only.
    if (rect.width <= 2 && rect.height <= 2) return false;
    const style = styleOf(el);
    return !(style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) < 0.05);
  };
  /** Shown, and no ancestor hides it (a closed panel keeps its children laid out). */
  const reallyShown = (el: Element): boolean => {
    // What the browser skips is not painted: the inside of a closed <details> (content-visibility: hidden) still
    // answers with a box where it would stand if opened, over whatever follows the disclosure.
    if (!el.checkVisibility()) return false;
    let current: Element | null = el;
    while (current && current !== document.documentElement) {
      const style = styleOf(current);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.05) return false;
      current = current.parentElement;
    }
    return shown(el);
  };
  const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]';
  const isControl = (el: Element) => el.matches(CONTROL);
  const ownTextNodes = (el: Element): Text[] => Array.from(el.childNodes).filter((node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
  const hasOwnText = (el: Element) => ownTextNodes(el).length > 0;
  const textBox = (el: Element): DOMRect | null => {
    const nodes = ownTextNodes(el);
    if (nodes.length === 0) return null;
    const range = document.createRange();
    range.setStartBefore(nodes[0]);
    range.setEndAfter(nodes[nodes.length - 1]);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  };
  /** Something a person reads or presses, as opposed to a glow or a rule drawn with an empty box. */
  const meaningful = (el: Element) => isControl(el) || hasOwnText(el) || el.matches('img, svg, canvas, video');
  /** An empty box that is still seen: the thumb of a switch, a swatch, a bar. */
  const painted = (el: Element) => {
    const style = styleOf(el);
    const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(style.backgroundColor);
    const solid = style.backgroundColor !== 'transparent' && (!alpha || Number(alpha[1]) > 0.15);
    return solid || style.backgroundImage !== 'none';
  };

  /** A box with an edge a person sees (a fill, a border, a shadow): something can be seen sticking out of it. */
  const framed = (el: Element) => {
    if (painted(el)) return true;
    const style = styleOf(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    const border = sides.some((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none' && !/rgba\([^)]*,\s*0\)|transparent/.test(style[`border${side}Color`]));
    return border || style.boxShadow !== 'none';
  };

  const containsPaint = (style: CSSStyleDeclaration) => /paint|layout|strict|content/.test(style.contain) || (style.containerType !== '' && style.containerType !== 'normal');
  const holdsFixed = (style: CSSStyleDeclaration) => style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' || containsPaint(style) || /transform|filter|perspective/.test(style.willChange) || (style.backdropFilter !== undefined && style.backdropFilter !== 'none' && style.backdropFilter !== '');
  const holdsAbsolute = (style: CSSStyleDeclaration) => style.position !== 'static' || holdsFixed(style);

  interface Visible { left: number; right: number; top: number; bottom: number; clipX: Element | null; clipY: Element | null }
  /**
   * What is left of a box after every ancestor that clips it. `clipX`/`clipY` name the first ancestor that cuts
   * it and does not scroll that way (content scrolled out of a list is not a fault). An absolutely placed part
   * is cut only by the boxes that hold it, the way the browser does it.
   */
  const visibleOf = (el: Element, rect: DOMRect, stop: Element | null, includeStop = false): Visible => {
    const out: Visible = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, clipX: null, clipY: null };
    let position = styleOf(el).position;
    let current = el.parentElement;
    while (current && current !== document.documentElement && (includeStop || current !== stop)) {
      const style = styleOf(current);
      const holds = position === 'fixed' ? holdsFixed(style) : position === 'absolute' ? holdsAbsolute(style) : true;
      if (holds) {
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          const box = current.getBoundingClientRect();
          if (style.overflowX !== 'visible') {
            const hard = style.overflowX === 'hidden' || style.overflowX === 'clip';
            if (hard && (box.left > out.left + TOLERANCE || box.right < out.right - TOLERANCE)) out.clipX = out.clipX ?? current;
            out.left = Math.max(out.left, box.left);
            out.right = Math.min(out.right, box.right);
          }
          if (style.overflowY !== 'visible') {
            const hard = style.overflowY === 'hidden' || style.overflowY === 'clip';
            if (hard && (box.top > out.top + TOLERANCE || box.bottom < out.bottom - TOLERANCE)) out.clipY = out.clipY ?? current;
            out.top = Math.max(out.top, box.top);
            out.bottom = Math.min(out.bottom, box.bottom);
          }
        }
        position = style.position;
      }
      if (current === stop) break;
      current = current.parentElement;
    }
    return out;
  };

  const LAYER = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper], .app-toast';
  const layerOf = (el: Element) => el.closest(LAYER);

  const scope = (options.root ? document.querySelector(options.root) : null) ?? document.body;
  const all = Array.from(scope.querySelectorAll('*')).filter((el) => {
    if (isIgnored(el) || !reallyShown(el)) return false;
    // On a canvas only its objects are judged; the layers that hold them are as large as the canvas.
    return !(inIsland(el) && !unitOf(el));
  });
  const shownSet = new Set(all);

  // 1. Parts against the box they belong to, innermost boxes first so each fault is named once, where it starts.
  const blamed = new Set<Element>();
  const isBlamed = (el: Element) => {
    let current: Element | null = el;
    while (current) {
      if (blamed.has(current)) return true;
      current = current.parentElement;
    }
    return false;
  };
  const shortenedOk = (el: Element) => options.shortenedOk.some((selector) => el.matches(selector) || el.closest(selector) !== null);
  for (let index = all.length - 1; index >= 0; index -= 1) {
    const el = all[index];
    if (surfaces.has(el)) continue;
    const element = el as HTMLElement;
    const style = styleOf(el);
    if (style.display === 'inline' || el.tagName === 'svg' || el.closest('svg')) continue;
    if (element.clientWidth <= 0 || element.offsetWidth <= 0) continue;
    const overX = element.scrollWidth - element.clientWidth;
    const overY = element.scrollHeight - element.clientHeight;
    if (overX > TOLERANCE) {
      const numbers = `content ${element.scrollWidth}px in a box of ${element.clientWidth}px`;
      const scrolls = style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (scrolls) {
        // A field scrolls its own text sideways; that is how a field works.
        if (!el.matches('input, textarea, pre, code')) report('scrolls-sideways', el, numbers);
        blamed.add(el);
        continue;
      }
      if (style.overflowX !== 'visible' && style.textOverflow === 'ellipsis') {
        // Less than a couple of letters left: an ellipsis no longer helps.
        if (element.clientWidth < 22 && hasOwnText(el)) report('squeezed', el, numbers);
        else if (options.shortened && !shortenedOk(el)) report('shortened', el, numbers);
        blamed.add(el);
        continue;
      }
      if (el.matches('input, textarea')) continue;
      // Which part is it? Compare what can be seen of each part with the inner edge of this box.
      const box = el.getBoundingClientRect();
      const scale = box.width / element.offsetWidth || 1;
      const innerLeft = box.left + element.clientLeft * scale;
      const innerRight = innerLeft + element.clientWidth * scale;
      let worst: { el: Element; by: number } | null = null;
      const consider = (part: Element, rect: DOMRect) => {
        const visible = visibleOf(part, rect, el);
        if (visible.right - visible.left < 1 || visible.bottom - visible.top < 1) return;
        const by = Math.max(visible.right - innerRight, innerLeft - visible.left);
        if (by > TOLERANCE && (!worst || by > worst.by)) worst = { el: part, by };
      };
      const own = textBox(el);
      if (own) {
        const by = Math.max(own.right - innerRight, innerLeft - own.left);
        if (by > TOLERANCE) worst = { el, by };
      }
      const layer = layerOf(el);
      for (const part of Array.from(el.querySelectorAll('*'))) {
        if (!shownSet.has(part) || isOverhang(part) || isBlamed(part)) continue;
        // Out of a box that does not clip, anything painted is seen sticking out; in a box that clips, a glow
        // or a rule cut by it is its design, and only words, pictures and controls are a loss.
        if (!meaningful(part) && !(style.overflowX === 'visible' && painted(part))) continue;
        // What floats (a list or a search box that opens from a button) is a layer of its own, not a part of the row.
        if (layerOf(part) !== layer) continue;
        const rect = hasOwnText(part) && !isControl(part) ? (textBox(part) ?? part.getBoundingClientRect()) : part.getBoundingClientRect();
        consider(part, rect);
      }
      const found = worst as { el: Element; by: number } | null;
      // A box nobody sees (no fill, no border, it clips nothing) has no edge to stick out of: a wrapper that only
      // places its content. Its part is left for a box around it that does have an edge.
      if (found && style.overflowX === 'visible' && !framed(el) && found.el !== el) continue;
      if (found) {
        const what = found.el === el ? 'its own text' : `"${textOf(found.el)}" (${cls(found.el)})`;
        if (style.overflowX === 'visible') report('spills', el, `sideways: ${what} sticks out by ${Math.round(found.by)}px; ${numbers}`);
        else report('cut', el, `sideways: ${what} is cut by ${Math.round(found.by)}px; ${numbers}`);
        blamed.add(found.el);
        blamed.add(el);
      }
    }
    // A control of fixed height whose words are taller: they lie over what comes next, or lose their last line.
    if (overY > 3 && element.clientHeight > 0 && (isControl(el) || el.closest(CONTROL) !== null) && !el.matches('textarea, select')) {
      const numbers = `content ${element.scrollHeight}px in a box of ${element.clientHeight}px`;
      if (style.overflowY === 'visible') report('spills', el, `downwards: ${numbers}`);
      else if ((style.overflowY === 'hidden' || style.overflowY === 'clip') && hasOwnText(el)) report('cut', el, `downwards: ${numbers}`);
    }
  }

  // 2. Controls and texts against the panels that clip them, and controls against the window.
  const controls = all.filter(isControl);
  const visibles = new Map<Element, Visible>();
  for (const el of all) {
    const control = isControl(el);
    if (!control && (!hasOwnText(el) || el.closest(CONTROL) !== null)) continue;
    let rect = control ? el.getBoundingClientRect() : textBox(el);
    if (!rect) continue;
    if (!control) {
      // A text shortened by its own box (an ellipsis) is judged in part 1; here it is as wide as that box shows.
      const own = styleOf(el);
      if (own.overflowX !== 'visible' || own.overflowY !== 'visible') {
        const box = el.getBoundingClientRect();
        const left = Math.max(rect.left, box.left);
        const top = Math.max(rect.top, box.top);
        rect = new DOMRect(left, top, Math.max(0, Math.min(rect.right, box.right) - left), Math.max(0, Math.min(rect.bottom, box.bottom) - top));
        if (rect.width < 1 || rect.height < 1) continue;
      }
    }
    const unit = unitOf(el);
    // A canvas object is cut by its own card at most: the canvas edge is not a fault of the card.
    const visible = unit === el ? visibleOf(el, rect, el.parentElement) : visibleOf(el, rect, unit, unit !== null);
    if (control) visibles.set(el, visible);
    // Wholly scrolled out of a list is not on screen at all; only what is partly there is "cut".
    const width = visible.right - visible.left;
    const height = visible.bottom - visible.top;
    const partlyX = width > 2 && width < rect.width - TOLERANCE;
    const partlyY = height > 2 && height < rect.height - TOLERANCE;
    // A line shortened with an ellipsis is cut by its own box on purpose; that is judged above.
    const ownEllipsis = (clip: Element | null) => clip !== null && styleOf(clip).textOverflow === 'ellipsis';
    if (visible.clipX && partlyX && !ownEllipsis(visible.clipX)) report('clipped', el, `sideways by ${where(visible.clipX)}: ${Math.round(rect.width - width)}px of ${Math.round(rect.width)}px hidden`);
    if (visible.clipY && partlyY && !ownEllipsis(visible.clipY)) report('clipped', el, `vertically by ${where(visible.clipY)}: ${Math.round(rect.height - height)}px of ${Math.round(rect.height)}px hidden`);
    // What is on screen at all must be inside the window (a node on the canvas is wherever it was put).
    if (control && !unit && width > 2 && height > 2 && (visible.left < -TOLERANCE || visible.right > vw + TOLERANCE)) {
      report('outside-window', el, `sideways: ${Math.round(visible.left)}…${Math.round(visible.right)} in a window of ${vw}px`);
    }
  }

  // 3. Floating surfaces (dialogs, menus, popovers, toasts) against the window.
  const SURFACE = '[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper] > *, .app-toast';
  for (const el of Array.from(document.querySelectorAll(SURFACE))) {
    if (isIgnored(el) || !reallyShown(el) || unitOf(el) || !(scope === el || scope.contains(el))) continue;
    const rect = el.getBoundingClientRect();
    const out: string[] = [];
    if (rect.left < -TOLERANCE) out.push(`${Math.round(-rect.left)}px past the left edge`);
    if (rect.right > vw + TOLERANCE) out.push(`${Math.round(rect.right - vw)}px past the right edge`);
    if (rect.top < -TOLERANCE) out.push(`${Math.round(-rect.top)}px above the top`);
    if (rect.bottom > vh + TOLERANCE) out.push(`${Math.round(rect.bottom - vh)}px below the bottom`);
    if (out.length > 0) report('outside-window', el, out.join(', '));
  }
  if (scope === document.body && document.documentElement.scrollWidth > vw + TOLERANCE) {
    report('outside-window', document.documentElement, `the page is ${document.documentElement.scrollWidth}px wide in a window of ${vw}px`);
  }

  // 4. Controls lying on each other: what can be seen of one over what can be seen of the other.
  const boxes = controls
    .map((el) => ({ el, box: visibles.get(el) as Visible, unit: unitOf(el) }))
    .filter(({ box }) => box && box.right - box.left > 3 && box.bottom - box.top > 3 && box.right > 0 && box.bottom > 0 && box.left < vw && box.top < vh);
  // A toast is a layer too: it lies over the page for a few seconds and goes.
  const topSurface = layerOf;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // Different layers (a dialog over the page) overlap by design; so do the page and what lies on a canvas.
      if (topSurface(a.el) !== topSurface(b.el) || a.unit !== b.unit) continue;
      const x = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const y = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (x <= 3 || y <= 3) continue;
      // A small button drawn inside a field (clear, reveal, chevron) sits within it on purpose.
      const inside = (inner: Visible, outer: Visible) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
      if (inside(a.box, b.box) || inside(b.box, a.box)) continue;
      const hit = document.elementFromPoint(Math.max(a.box.left, b.box.left) + x / 2, Math.max(a.box.top, b.box.top) + y / 2);
      if (!hit || !(a.el.contains(hit) || b.el.contains(hit) || hit.contains(a.el) || hit.contains(b.el))) continue;
      report('overlap', a.el, `with ${where(b.el)} "${textOf(b.el)}" by ${Math.round(x)}×${Math.round(y)}px`);
    }
  }

  // 4b. What belongs to the page (a toolbar over the canvas, its buttons) lies over what lies on the canvas, never
  // under it: a note that travels with a node must pass behind the toolbar, not over its buttons.
  for (const { el, box, unit } of boxes) {
    if (unit) continue;
    const hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    if (!hit || el.contains(hit) || hit.contains(el)) continue;
    const over = unitOf(hit);
    if (over) report('overlap', el, `is covered by what lies on the canvas: ${where(over)} "${textOf(over)}"`);
  }

  // 5. A text lying on a control or on another text: words nobody can read. Texts are taken line by line, the
  // way they are drawn, so a paragraph that wraps around a badge is not mistaken for one that covers it.
  interface Lines { el: Element; lines: Array<{ left: number; right: number; top: number; bottom: number }>; unit: Element | null; layer: Element | null }
  const texts: Lines[] = [];
  for (const el of all) {
    if (isControl(el) || el.closest(CONTROL) !== null || !hasOwnText(el) || el.closest('svg')) continue;
    const nodes = ownTextNodes(el);
    const range = document.createRange();
    range.setStartBefore(nodes[0]);
    range.setEndAfter(nodes[nodes.length - 1]);
    const whole = range.getBoundingClientRect();
    if (whole.width < 2 || whole.height < 2) continue;
    const unit = unitOf(el);
    const window_ = unit === el ? visibleOf(el, whole, el.parentElement) : visibleOf(el, whole, unit, unit !== null);
    // The text's own box may cut it too (an ellipsis).
    const own = styleOf(el);
    const box = own.overflowX !== 'visible' || own.overflowY !== 'visible' ? el.getBoundingClientRect() : null;
    const lines = Array.from(range.getClientRects()).slice(0, 12).map((line) => ({
      left: Math.max(line.left, window_.left, box ? box.left : -Infinity),
      right: Math.min(line.right, window_.right, box ? box.right : Infinity),
      top: Math.max(line.top, window_.top, box ? box.top : -Infinity),
      bottom: Math.min(line.bottom, window_.bottom, box ? box.bottom : Infinity),
    })).filter((line) => line.right - line.left > 3 && line.bottom - line.top > 3 && line.right > 0 && line.bottom > 0 && line.left < vw && line.top < vh);
    if (lines.length > 0) texts.push({ el, lines, unit, layer: layerOf(el) });
  }
  const collide = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    // Line boxes are a little taller than the letters: a few shared pixels between two lines are not a collision.
    const need = Math.max(5, 0.45 * Math.min(a.bottom - a.top, b.bottom - b.top));
    return x > 5 && y > need ? { x, y, cx: Math.max(a.left, b.left) + x / 2, cy: Math.max(a.top, b.top) + y / 2 } : null;
  };
  const drawnAt = (cx: number, cy: number, a: Element, b: Element) => {
    const hit = document.elementFromPoint(cx, cy);
    return Boolean(hit) && [a, b].some((one) => one.contains(hit) || (hit as Element).contains(one));
  };
  for (let i = 0; i < texts.length; i += 1) {
    const a = texts[i];
    // On a control: a text that is not the control's own label lies across its edge.
    for (const b of boxes) {
      if (a.layer !== topSurface(b.el) || a.unit !== b.unit || b.el.contains(a.el) || a.el.contains(b.el)) continue;
      for (const line of a.lines) {
        // Wholly inside a field (a unit drawn in it, a hint over an empty field) is that field's own drawing.
        if (line.left >= b.box.left - 1 && line.right <= b.box.right + 1 && line.top >= b.box.top - 1 && line.bottom <= b.box.bottom + 1) continue;
        const hit = collide(line, b.box);
        if (hit && drawnAt(hit.cx, hit.cy, a.el, b.el)) {
          report('overlap', a.el, `the text lies on ${where(b.el)} "${textOf(b.el)}" by ${Math.round(hit.x)}×${Math.round(hit.y)}px`);
          break;
        }
      }
    }
    for (let j = i + 1; j < texts.length; j += 1) {
      const b = texts[j];
      if (a.layer !== b.layer || a.unit !== b.unit || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      let found = false;
      for (const first of a.lines) {
        for (const second of b.lines) {
          const hit = collide(first, second);
          if (hit && drawnAt(hit.cx, hit.cy, a.el, b.el)) {
            report('overlap', a.el, `the text lies on the text "${textOf(b.el)}" (${where(b.el)}) by ${Math.round(hit.x)}×${Math.round(hit.y)}px`);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }

  // 6. Words that are not words. Read from what is shown and from tooltips and labels, outside what the person
  // or a model wrote themselves.
  if (options.keyRoots.length > 0) {
    const own = collect(options.ownWords);
    const isOwn = (el: Element) => own.some((root) => root === el || root.contains(el));
    const keyPattern = new RegExp(`(?:^|[^\\w./-])((?:${options.keyRoots.join('|')})\\.[A-Za-z][A-Za-z0-9]*(?:\\.[A-Za-z0-9_]+)*)(?![\\w/-])`);
    const judge = (text: string): string | null => {
      if (/\{\{|\}\}/.test(text)) return 'a placeholder left in the text';
      if (/\[object Object\]/.test(text)) return 'an object printed as text';
      if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text)) return 'an internal id shown where a name belongs';
      if (/(?:^|[\s:(«"'=,])(?:undefined|NaN)(?=$|[\s.,;:)»"'%])/.test(text)) return 'a missing value printed as text';
      const key = keyPattern.exec(text);
      // A file name ("settings.json") is not a key: a key's last part is a word, not an extension people know.
      if (key && !/\.(?:json|js|ts|css|md|txt|log|png|jpg|safetensors|ckpt|pt|pth|bin|gguf|yaml|yml|html)$/i.test(key[1])) return `a translation key instead of its text ("${key[1]}")`;
      return null;
    };
    for (const el of all) {
      if (isOwn(el) || el.closest('svg')) continue;
      const pieces: string[] = ownTextNodes(el).map((node) => node.textContent ?? '');
      for (const name of ['title', 'aria-label', 'placeholder', 'alt']) {
        const value = el.getAttribute(name);
        if (value) pieces.push(value);
      }
      for (const piece of pieces) {
        const why = judge(piece);
        if (why) {
          report('raw-text', el, `${why}: "${piece.replace(/\s+/g, ' ').trim().slice(0, 120)}"`);
          break;
        }
      }
    }
  }
  return issues;
}

/** Audits the page as it is now. */
export async function auditLayout(page: Page, options: AuditOptions = {}): Promise<LayoutIssue[]> {
  return page.evaluate(auditInPage, {
    ignore: options.ignore ?? [],
    islands: options.islands ?? [],
    units: options.units ?? [],
    overhang: options.overhang ?? [],
    shortened: options.shortened === true,
    shortenedOk: options.shortenedOk ?? [],
    root: options.root ?? '',
    keyRoots: options.keyRoots ?? [],
    ownWords: options.ownWords ?? [],
  });
}

/** One line per issue, for a report a person reads. */
export function describeIssues(issues: LayoutIssue[]): string {
  return issues.map((issue) => `  [${issue.kind}] ${issue.where}\n      "${issue.text}"\n      ${issue.detail}`).join('\n');
}
