import { test, expect, type Page, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow, hundredNodeWorkflow } from './fixtures/denseWorkflow';

const artifactDir = '/opt/cursor/artifacts';

function asRgb(color: string): string {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!hex) return color;
  const value = Number.parseInt(hex[1], 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

function contrast(a: string, b: string): number {
  const parse = (color: string) => {
    const match = asRgb(color).match(/rgba?\(([^)]+)\)/);
    if (!match) return [0, 0, 0];
    return match[1].split(',').slice(0, 3).map((part) => Number(part.trim()));
  };
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const lum = (color: string) => {
    const [r, g, b] = parse(color);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const left = lum(a);
  const right = lum(b);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectSettledGraph(window: Page) {
  const duration = Number(await window.locator('.graph-canvas').getAttribute('data-fit-duration')) || 0;
  const started = Date.now();
  let previous = '';
  await expect.poll(async () => {
    const next = await window.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform);
    const stable = previous !== '' && next === previous && Date.now() - started >= duration;
    previous = next;
    return stable ? next : '';
  }).not.toBe('');
  const fit = await window.evaluate(() => {
    const pane = document.querySelector('.react-flow__pane')?.getBoundingClientRect();
    const map = document.querySelector('.graph-minimap')?.getBoundingClientRect();
    const transform = getComputedStyle(document.querySelector('.react-flow__viewport')!).transform;
    const zoom = Number(transform.match(/matrix\(([-0-9.eE]+)/)?.[1] ?? '0');
    const nodes = [...document.querySelectorAll('.react-flow__node')];
    const outside = pane ? nodes.flatMap((node) => {
      const box = node.getBoundingClientRect();
      const overflow = {
        left: pane.left - box.left,
        right: box.right - pane.right,
        top: pane.top - box.top,
        bottom: box.bottom - pane.bottom,
      };
      const clipped = overflow.left > 1 || overflow.right > 1 || overflow.top > 1 || overflow.bottom > 1;
      if (!clipped) return [];
      const name = (node.textContent || 'node').slice(0, 24);
      return [`${name} L${overflow.left.toFixed(1)} R${overflow.right.toFixed(1)} T${overflow.top.toFixed(1)} B${overflow.bottom.toFixed(1)}`];
    }) : ['pane-missing'];
    const hits = map ? nodes.flatMap((node) => {
      const box = node.getBoundingClientRect();
      const clear = box.right <= map.left || box.left >= map.right || box.bottom <= map.top || box.top >= map.bottom;
      return clear ? [] : [(node.textContent || 'node').slice(0, 24)];
    }) : ['minimap-missing'];
    return {
      missing: !map,
      width: map ? Math.round(map.width) : 0,
      height: map ? Math.round(map.height) : 0,
      hits,
      outside,
      nodes: nodes.length,
      zoom,
    };
  });
  expect(fit.missing).toBe(false);
  expect(fit.width).toBe(144);
  expect(fit.height).toBe(96);
  expect(fit.hits).toEqual([]);
  expect(fit.outside).toEqual([]);
  expect(fit.nodes).toBeGreaterThan(0);
  console.log(`MINIMAP ${fit.width}x${fit.height} overlaps=0`);
  console.log(`NODES_INSIDE ${fit.nodes} outside=0 zoom=${fit.zoom.toFixed(4)}`);
  return fit.zoom;
}

test('desktop captures at 1024 and 1280 with rendered contrast', async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-captures-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await window.locator('#chat-provider').waitFor();

  const measure = async (width: number, height: number, name: string) => {
    await window.setViewportSize({ width, height });
    const metrics = await window.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const title = document.querySelector('.app-title');
      const note = document.querySelector('.provider-chip');
      const disabled = document.querySelector('.ghost-button:disabled');
      const read = (element: Element | null) => element ? getComputedStyle(element).color : '';
      const undo = document.querySelector('button[disabled]');
      return {
        dpr: window.devicePixelRatio,
        inner: `${window.innerWidth}x${window.innerHeight}`,
        text: read(title),
        muted: read(note),
        disabled: read(disabled),
        focus: styles.getPropertyValue('--focus').trim(),
        bar: document.querySelector('.document-bar') ? getComputedStyle(document.querySelector('.document-bar') as Element).backgroundColor : '',
        canvas: document.querySelector('.graph-canvas') ? getComputedStyle(document.querySelector('.graph-canvas') as Element).backgroundColor : '',
        border: styles.getPropertyValue('--control-border').trim(),
        surface: styles.getPropertyValue('--surface').trim(),
        types: ['--type-model', '--type-clip', '--type-vae', '--type-conditioning', '--type-latent', '--type-image'].map((token) => styles.getPropertyValue(token).trim()),
        undoDisabled: undo instanceof HTMLButtonElement && undo.disabled,
      };
    });
    console.log(`CAPTURE ${name} ${metrics.inner} dpr=${metrics.dpr} text=${metrics.text} muted=${metrics.muted} disabled=${metrics.disabled} focus=${metrics.focus} bar=${metrics.bar}`);
    const textRatio = contrast(metrics.text, metrics.bar);
    const mutedRatio = contrast(metrics.muted, metrics.bar);
    const disabledRatio = contrast(metrics.disabled, metrics.bar);
    const focusRatio = contrast(metrics.focus, metrics.bar);
    const borderRatio = contrast(metrics.border, metrics.surface);
    const typeRatios = metrics.types.map((token) => contrast(token, metrics.canvas));
    console.log(`CONTRAST ${name} text=${textRatio.toFixed(2)} muted=${mutedRatio.toFixed(2)} disabled=${disabledRatio.toFixed(2)} focus=${focusRatio.toFixed(2)} border=${borderRatio.toFixed(2)} types=${typeRatios.map((ratio) => ratio.toFixed(2)).join(',')}`);
    expect(textRatio).toBeGreaterThanOrEqual(4.5);
    expect(mutedRatio).toBeGreaterThanOrEqual(4.5);
    expect(disabledRatio).toBeGreaterThanOrEqual(4.5);
    expect(focusRatio).toBeGreaterThanOrEqual(3);
    expect(borderRatio).toBeGreaterThanOrEqual(3);
    expect(Math.min(...typeRatios)).toBeGreaterThanOrEqual(3);
    expect(metrics.undoDisabled).toBe(true);
    if (width === 1024) {
      const canvas = await window.locator('.graph-pane').evaluate((element) => Math.round(element.getBoundingClientRect().width));
      const dock = await window.locator('.dock').evaluate((element) => Math.round(element.getBoundingClientRect().width));
      console.log(`CANVAS_1024 ${canvas} dock=${dock}`);
      expect(dock).toBe(336);
      expect(canvas).toBe(688);
      const toolbar = await window.locator('.workspace-toolbar').evaluate((element) => {
        const trigger = element.querySelector('#chat-provider');
        const value = trigger?.querySelector('span');
        const range = document.createRange();
        if (value) range.selectNodeContents(value);
        return {
          overflow: element.scrollWidth - element.clientWidth,
          height: Math.round(element.getBoundingClientRect().height),
          lines: value ? range.getClientRects().length : 0,
          valueHeight: value ? Math.round(value.getBoundingClientRect().height) : 0,
          label: value?.textContent ?? '',
        };
      });
      console.log(`TOOLBAR_1024 overflow=${toolbar.overflow} height=${toolbar.height} lines=${toolbar.lines} valueHeight=${toolbar.valueHeight} label=${toolbar.label}`);
      expect(toolbar.overflow).toBe(0);
      expect(toolbar.height).toBe(40);
      expect(toolbar.lines).toBe(1);
      expect(toolbar.valueHeight).toBeLessThanOrEqual(20);
      expect(toolbar.label).toBe('Not configured');
    }
    await window.screenshot({ path: path.join(artifactDir, `desktop-${name}-empty.png`) });
    const showBoth = window.getByRole('button', { name: 'Show both' });
    if (width >= 1280) await expect(showBoth).toBeEnabled();
    else await expect(showBoth).toBeDisabled();
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    await expect(dialog).toHaveAttribute('data-state', 'open');
    for (const label of ['Connection', 'Assistant', 'Appearance & Motion']) {
      const box = await dialog.getByRole('tab', { name: label }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    }
    await dialog.getByRole('tab', { name: 'Connection' }).click();
    await window.screenshot({ path: path.join(artifactDir, `desktop-${name}-settings-connection.png`) });
    await dialog.getByRole('tab', { name: 'Appearance & Motion' }).click();
    await expect(dialog.getByRole('combobox', { name: 'Motion', exact: true })).toBeVisible();
    await window.screenshot({ path: path.join(artifactDir, `desktop-${name}-settings.png`) });
    await window.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  };

  await measure(1024, 768, '1024');
  await measure(1280, 800, '1280');

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (payload) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (input: unknown) => Promise<{ status: string }> } }).electronAPI;
    return bridge.commitCommand(payload);
  }, {
    projectId: 'desktop',
    actionId: 'capture-graph',
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: denseWorkflow },
  });
  expect(imported.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(12);
  await window.setViewportSize({ width: 1024, height: 768 });
  await window.getByRole('tab', { name: 'Inspector' }).click();
  await window.locator('.react-flow__node').first().click();
  await window.locator('.react-flow__controls-fitview').click();
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('CheckpointLoaderSimple');
  const zoom1024 = await expectSettledGraph(window);
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1024-graph.png') });
  const importButton = window.getByRole('button', { name: 'Import' });
  await importButton.hover();
  await expect.poll(async () => importButton.evaluate((element) => {
    const token = getComputedStyle(document.documentElement).getPropertyValue('--bg-hover').trim();
    const probe = document.createElement('span');
    probe.style.color = token;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(element).backgroundColor === resolved;
  })).toBe(true);
  const hover = await importButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  const hoverRatio = contrast(hover.color, hover.background);
  console.log(`HOVER_BUTTON ${hoverRatio.toFixed(2)} ${hover.color} on ${hover.background}`);
  expect(hoverRatio).toBeGreaterThanOrEqual(4.5);
  const pressPolicy = await importButton.evaluate(() => {
    const motion = document.documentElement.dataset.motion || '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shift = motion === 'on' || ((motion === 'system' || motion === '') && !reduce);
    return { motion, reduce, shift };
  });
  const importBox = await importButton.boundingBox();
  await window.mouse.move(importBox!.x + 8, importBox!.y + 8);
  await window.mouse.down();
  const expectedPress = pressPolicy.shift ? 'matrix(1, 0, 0, 1, 0, 1)' : 'none';
  await expect.poll(async () => importButton.evaluate((element) => getComputedStyle(element).transform)).toBe(expectedPress);
  const pressed = await importButton.evaluate((element) => getComputedStyle(element).transform);
  await window.mouse.up();
  console.log(`PRESS_BUTTON transform=${pressed} motion=${pressPolicy.motion} reduce=${pressPolicy.reduce}`);
  await window.setViewportSize({ width: 1440, height: 900 });
  await window.locator('.react-flow__controls-fitview').click();
  const zoom1440 = await expectSettledGraph(window);
  const resized = await window.evaluate(() => ({
    bar: Math.round(document.querySelector('.document-bar')!.getBoundingClientRect().height),
    toolbar: Math.round(document.querySelector('.workspace-toolbar')!.getBoundingClientRect().height),
    toolbarOverflow: document.querySelector('.workspace-toolbar')!.scrollWidth - document.querySelector('.workspace-toolbar')!.clientWidth,
    canvas: Math.round(document.querySelector('.graph-pane')!.getBoundingClientRect().width),
    dock: Math.round(document.querySelector('.dock')!.getBoundingClientRect().width),
  }));
  console.log(`RESIZE_1440 from=1024 zoom=${zoom1440.toFixed(4)} ${JSON.stringify(resized)}`);
  expect(resized.bar).toBe(48);
  expect(resized.toolbar).toBe(40);
  expect(resized.toolbarOverflow).toBe(0);
  expect(resized.dock).toBe(336);
  expect(resized.canvas).toBeGreaterThanOrEqual(1440 - resized.dock);
  expect(resized.canvas).toBeLessThanOrEqual(1440 - resized.dock + 2);
  await window.setViewportSize({ width: 1280, height: 800 });
  await window.locator('.react-flow__controls-fitview').click();
  const zoom1280 = await expectSettledGraph(window);
  expect(zoom1024).not.toBe(zoom1280);
  console.log(`FIT_ZOOM 1024=${zoom1024.toFixed(4)} 1280=${zoom1280.toFixed(4)} 1440=${zoom1440.toFixed(4)}`);
  await window.locator('.react-flow__node').nth(1).click({ modifiers: ['Control'] });
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('2 nodes selected');
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('Shared edits are not available.');
  console.log('MULTI_SELECT 2 nodes; shared edits are not available');
  await window.locator('.react-flow__node').nth(2).click();
  await window.locator('.react-flow__node').first().click();
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('CheckpointLoaderSimple');
  await window.locator('.react-flow__controls-fitview').click();
  await expectSettledGraph(window);
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-graph.png') });
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-inspector.png') });
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  const contrastDialog = window.locator('[role="dialog"].settings-dialog');
  await contrastDialog.getByRole('tab', { name: 'Connection' }).click();
  await contrastDialog.getByRole('textbox', { name: 'Comfy origin' }).fill('https://example.test');
  await contrastDialog.getByRole('textbox', { name: 'Comfy origin' }).focus();
  await window.keyboard.press('Tab');
  await window.keyboard.press('Shift+Tab');
  await expect.poll(async () => contrastDialog.getByRole('button', { name: 'Save settings' }).evaluate((button) => getComputedStyle(button).backgroundColor)).toBe('rgb(101, 217, 237)');
  const rendered = await window.evaluate(() => {
    const paint = (element: Element | null, pseudo?: string) => element ? getComputedStyle(element, pseudo) : null;
    const neighbor = (element: Element | null) => {
      let node = element?.parentElement ?? null;
      while (node) {
        const color = getComputedStyle(node).backgroundColor;
        const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
        if (parts.length < 4 || parts[3] > 0.9) return color;
        node = node.parentElement;
      }
      return 'rgb(0, 0, 0)';
    };
    const input = document.querySelector('input[aria-label="Comfy origin"]');
    const disabled = document.querySelector('input[aria-label="API key"]');
    const save = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Save settings') ?? null;
    const handle = document.querySelector('.graph-node .react-flow__handle');
    const edge = document.querySelector('.react-flow__edge path');
    const inputStyle = paint(input);
    const disabledStyle = paint(disabled);
    const saveStyle = paint(save);
    return {
      inputColor: inputStyle?.color ?? '',
      inputBg: inputStyle?.backgroundColor ?? '',
      inputBorder: inputStyle?.borderTopColor ?? '',
      disabledColor: disabledStyle?.color ?? '',
      disabledBg: disabledStyle?.backgroundColor ?? '',
      disabledBorder: disabledStyle?.borderTopColor ?? '',
      dialogBg: paint(document.querySelector('.settings-dialog'))?.backgroundColor ?? '',
      saveColor: saveStyle?.color ?? '',
      saveBg: saveStyle?.backgroundColor ?? '',
      focusOutline: inputStyle?.outlineColor ?? '',
      focusStyle: inputStyle?.outlineStyle ?? '',
      focusMatches: document.activeElement === input,
      focusNeighbor: neighbor(input),
      selectedOutline: paint(document.querySelector('.graph-node.is-selected'))?.outlineColor ?? '',
      selectedNeighbor: paint(document.querySelector('.graph-canvas'))?.backgroundColor ?? '',
      port: paint(handle, '::after')?.backgroundColor ?? '',
      nodeBg: paint(handle?.closest('.graph-node') ?? null)?.backgroundColor ?? '',
      edge: paint(edge)?.stroke ?? '',
      canvasBg: paint(document.querySelector('.graph-canvas'))?.backgroundColor ?? '',
    };
  });
  const pairs = {
    inputText: contrast(rendered.inputColor, rendered.inputBg),
    disabledText: contrast(rendered.disabledColor, rendered.disabledBg),
    inputBorder: contrast(rendered.inputBorder, rendered.dialogBg),
    disabledBorder: contrast(rendered.disabledBorder, rendered.dialogBg),
    save: contrast(rendered.saveColor, rendered.saveBg),
    focus: contrast(rendered.focusOutline, rendered.focusNeighbor),
    selected: contrast(rendered.selectedOutline, rendered.selectedNeighbor),
    port: contrast(rendered.port, rendered.nodeBg),
    edge: contrast(rendered.edge, rendered.canvasBg),
  };
  console.log(`RENDERED_CONTRAST ${Object.entries(pairs).map(([name, value]) => `${name}=${value.toFixed(2)}`).join(' ')}`);
  console.log(`RENDERED_COLORS input=${rendered.inputBg}/${rendered.inputBorder} disabled=${rendered.disabledBg}/${rendered.disabledBorder} save=${rendered.saveBg}/${rendered.saveColor} focus=${rendered.focusOutline} on ${rendered.focusNeighbor} selected=${rendered.selectedOutline} on ${rendered.selectedNeighbor} port=${rendered.port} on ${rendered.nodeBg} edge=${rendered.edge} on ${rendered.canvasBg}`);
  expect(rendered.inputBg).not.toBe(rendered.disabledBg);
  expect(rendered.focusMatches).toBe(true);
  expect(rendered.focusStyle).not.toBe('none');
  expect(pairs.inputText).toBeGreaterThanOrEqual(4.5);
  expect(pairs.disabledText).toBeGreaterThanOrEqual(4.5);
  expect(pairs.inputBorder).toBeGreaterThanOrEqual(3);
  expect(pairs.disabledBorder).toBeLessThanOrEqual(pairs.inputBorder);
  expect(pairs.save).toBeGreaterThanOrEqual(4.5);
  expect(pairs.focus).toBeGreaterThanOrEqual(3);
  expect(pairs.selected).toBeGreaterThanOrEqual(3);
  expect(pairs.port).toBeGreaterThanOrEqual(3);
  expect(pairs.edge).toBeGreaterThanOrEqual(3);
  await contrastDialog.getByRole('tab', { name: 'Assistant' }).click();
  await contrastDialog.getByRole('textbox', { name: 'Model' }).fill('sk-example-secret');
  await expect(contrastDialog.getByText('Settings cannot store a secret')).toBeVisible();
  await expect(contrastDialog.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  const errorColors = await window.evaluate(() => {
    const note = [...document.querySelectorAll('.settings-dialog [role="status"]')].find((element) => element.textContent?.includes('cannot store a secret'));
    const neighbor = (element: Element | null) => {
      let node = element?.parentElement ?? null;
      while (node) {
        const color = getComputedStyle(node).backgroundColor;
        const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
        if (parts.length < 4 || parts[3] > 0.9) return color;
        node = node.parentElement;
      }
      return 'rgb(0, 0, 0)';
    };
    const field = document.querySelector('input[aria-label="Model"]');
    return {
      color: note ? getComputedStyle(note).color : '',
      background: neighbor(note ?? null),
      role: note?.getAttribute('role') ?? '',
      invalid: field?.getAttribute('aria-invalid') ?? '',
      describedBy: field?.getAttribute('aria-describedby') ?? '',
    };
  });
  const errorRatio = contrast(errorColors.color, errorColors.background);
  console.log(`INVALID_FIELD_SAVE_BLOCKED ${errorRatio.toFixed(2)} ${errorColors.color} on ${errorColors.background} role=${errorColors.role || 'none'} aria-invalid=${errorColors.invalid || 'none'} aria-describedby=${errorColors.describedBy || 'none'}`);
  expect(errorRatio).toBeGreaterThanOrEqual(4.5);
  await window.keyboard.press('Escape');
  await expect(contrastDialog).toHaveCount(0);
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-assistant.png') });
  await window.getByRole('button', { name: 'Show both' }).click();
  await expect(window.getByRole('region', { name: 'Inspector' })).toBeVisible();
  await expect(window.getByRole('textbox', { name: 'Chat message' })).toBeVisible();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-split.png') });
  const osScale = await electronApp.evaluate(({ screen }) => {
    const display = screen.getPrimaryDisplay();
    return { scaleFactor: display.scaleFactor, size: display.size, workArea: display.workAreaSize };
  });
  console.log(`OS_SCALE ${JSON.stringify(osScale)} limit=this Linux session cannot change the host display scale; setZoomFactor below is page zoom, not OS DPI`);
  const chrome = await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return { maximizable: win.isMaximizable(), fullScreenable: win.isFullScreenable() };
  });
  console.log(`WINDOW_CHROME native frame maximizable=${chrome.maximizable} fullScreenable=${chrome.fullScreenable}; custom titlebar is absent, so move/maximize/double-click on a drag region is N/A`);
  expect(osScale.scaleFactor).toBeGreaterThan(0);

  const zoomTo = async (factor: number) => {
    await electronApp.evaluate(({ BrowserWindow }, next) => {
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(next);
    }, factor);
    const zoom = await window.evaluate(() => ({ dpr: window.devicePixelRatio, inner: `${window.innerWidth}x${window.innerHeight}` }));
    console.log(`ZOOM_${factor} ${zoom.inner} dpr=${zoom.dpr}`);
    return zoom;
  };
  const zoom125 = await zoomTo(1.25);
  expect(zoom125.dpr).toBeGreaterThan(1);
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-zoom125.png') });
  const zoom150 = await zoomTo(1.5);
  expect(zoom150.dpr).toBeGreaterThanOrEqual(1.5);
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-zoom150.png') });
  const zoom200 = await zoomTo(2);
  expect(zoom200.dpr).toBeGreaterThanOrEqual(2);
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-zoom200.png') });
  await zoomTo(1);

  const afterDense = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const started = Date.now();
  const hundred = await window.evaluate(async (payload) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (input: unknown) => Promise<{ status: string }> } }).electronAPI;
    return bridge.commitCommand(payload);
  }, {
    projectId: 'desktop',
    actionId: 'capture-hundred',
    expectedRevisionId: afterDense.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: hundredNodeWorkflow() },
  });
  expect(hundred.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(100);
  await expect(window.locator('.react-flow__edge')).toHaveCount(150);
  console.log(`NODES_100 ${Date.now() - started}ms edges=150`);
  await window.locator('.react-flow__controls-fitview').click();
  const before = await window.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform);
  const spot = await window.evaluate(() => {
    const pane = document.querySelector('.react-flow__pane')?.getBoundingClientRect();
    if (!pane) return null;
    const nodes = [...document.querySelectorAll('.react-flow__node')].map((node) => node.getBoundingClientRect());
    for (let y = pane.top + 12; y < pane.bottom - 12; y += 16) {
      for (let x = pane.left + 12; x < pane.right - 12; x += 16) {
        const covered = nodes.some((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
        if (!covered) return { x, y };
      }
    }
    return { x: pane.left + pane.width / 2, y: pane.top + 24 };
  });
  expect(spot).not.toBeNull();
  await window.evaluate(() => {
    const record = { frames: [] as number[], longtasks: [] as number[], unsupported: false, start: performance.now() };
    (window as unknown as { __pan: typeof record }).__pan = record;
    try {
      const observer = new PerformanceObserver((list) => {
        record.longtasks.push(...list.getEntries().map((entry) => Math.round(entry.duration)));
      });
      observer.observe({ entryTypes: ['longtask'] });
      (window as unknown as { __panObserver: PerformanceObserver }).__panObserver = observer;
    } catch {
      record.unsupported = true;
    }
    const tick = (now: number) => {
      record.frames.push(Math.round(now - record.start));
      if (performance.now() - record.start < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await window.mouse.move(spot!.x, spot!.y);
  await window.mouse.down();
  await window.mouse.move(spot!.x + 140, spot!.y + 70, { steps: 12 });
  await window.mouse.up();
  const after = await window.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform);
  const pan = await window.evaluate(() => {
    const record = (window as unknown as { __pan: { frames: number[]; longtasks: number[]; unsupported: boolean; start: number } }).__pan;
    const observer = (window as unknown as { __panObserver?: PerformanceObserver }).__panObserver;
    observer?.disconnect();
    const gaps = record.frames.slice(1).map((time, index) => time - record.frames[index]);
    return {
      frames: record.frames.length,
      elapsed: record.frames.length ? record.frames[record.frames.length - 1] : 0,
      maxGap: gaps.length ? Math.max(...gaps) : 0,
      longtasks: record.longtasks,
      unsupported: record.unsupported,
    };
  });
  console.log(`PAN_DRAG frames=${pan.frames} elapsed=${pan.elapsed}ms maxGap=${pan.maxGap}ms longtasks=${pan.unsupported ? 'unsupported' : pan.longtasks.join(',') || 'none'} transformChanged=${before !== after}`);
  expect(after).not.toBe(before);
  expect(pan.frames).toBeGreaterThan(1);
  await electronApp.close();
});
