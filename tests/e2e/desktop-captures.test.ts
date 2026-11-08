import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { typedWorkflow } from './fixtures/typedWorkflow';

const artifactDir = '/opt/cursor/artifacts';

function contrast(a: string, b: string): number {
  const parse = (color: string) => {
    const match = color.match(/rgba?\(([^)]+)\)/);
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
      const button = document.querySelector('.ghost-button');
      const read = (element: Element | null) => element ? getComputedStyle(element).color : '';
      return {
        dpr: window.devicePixelRatio,
        inner: `${window.innerWidth}x${window.innerHeight}`,
        text: read(title),
        muted: read(note),
        control: read(button),
        surface: styles.getPropertyValue('--surface').trim(),
        canvas: styles.getPropertyValue('--bg').trim(),
        accent: styles.getPropertyValue('--accent').trim(),
        border: styles.getPropertyValue('--control-border').trim(),
        surfaceComputed: title ? getComputedStyle(title).backgroundColor : '',
        bar: document.querySelector('.document-bar') ? getComputedStyle(document.querySelector('.document-bar') as Element).backgroundColor : '',
      };
    });
    console.log(`CAPTURE ${name} ${metrics.inner} dpr=${metrics.dpr} text=${metrics.text} muted=${metrics.muted} bar=${metrics.bar}`);
    const textRatio = contrast(metrics.text, metrics.bar);
    const mutedRatio = contrast(metrics.muted, metrics.bar);
    console.log(`CONTRAST ${name} text=${textRatio.toFixed(2)} muted=${mutedRatio.toFixed(2)} accent=${metrics.accent} border=${metrics.border}`);
    expect(textRatio).toBeGreaterThanOrEqual(4.5);
    expect(mutedRatio).toBeGreaterThanOrEqual(4.5);
    await window.screenshot({ path: path.join(artifactDir, `desktop-${name}-empty.png`) });
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(window.locator('[role="dialog"].settings-dialog')).toHaveAttribute('data-state', 'open');
    await window.screenshot({ path: path.join(artifactDir, `desktop-${name}-settings.png`) });
    await window.keyboard.press('Escape');
    await expect(window.locator('[role="dialog"].settings-dialog')).toHaveAttribute('data-state', 'closed');
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
    payload: { type: 'import-workflow', document: typedWorkflow },
  });
  expect(imported.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(3);
  await window.setViewportSize({ width: 1024, height: 768 });
  await window.locator('.react-flow__controls-fitview').click();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1024-graph.png') });
  await window.setViewportSize({ width: 1280, height: 800 });
  await window.locator('.react-flow__controls-fitview').click();
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-graph.png') });
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.setZoomFactor(1.25);
  });
  const zoom = await window.evaluate(() => ({ dpr: window.devicePixelRatio, inner: `${window.innerWidth}x${window.innerHeight}` }));
  console.log(`ZOOM_125 ${zoom.inner} dpr=${zoom.dpr}`);
  await window.screenshot({ path: path.join(artifactDir, 'desktop-1280-zoom125.png') });
  await electronApp.close();
});
