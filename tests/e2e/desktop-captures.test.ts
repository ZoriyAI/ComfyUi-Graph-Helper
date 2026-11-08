import { test, expect, _electron as electron } from '@playwright/test';
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
      const note = document.querySelector('.provider-note');
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
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1024-graph.png') });
  await window.setViewportSize({ width: 1280, height: 800 });
  await window.locator('.react-flow__controls-fitview').click();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-graph.png') });
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-inspector.png') });
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-assistant.png') });
  await window.getByRole('button', { name: 'Show both' }).click();
  await expect(window.getByRole('region', { name: 'Inspector' })).toBeVisible();
  await expect(window.getByRole('textbox', { name: 'Chat message' })).toBeVisible();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-split.png') });
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
  console.log(`NODES_100 ${Date.now() - started}ms`);
  await electronApp.close();
});
