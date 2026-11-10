import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { auditLayout, type LayoutIssue } from './layoutAudit';

/**
 * The walk (layout-walk.test.ts) trusts layoutAudit.ts to see what a person would. This shows it does: a page of
 * small layouts, each broken in one known way or sound in a way that looks like a fault, and the audit must name
 * every broken one and none of the sound ones. Without it a clean walk could mean a blind audit.
 */

const FIXTURE = `
<style>
  /* Three columns, so every case is in view: what is scrolled out of view cannot be hit-tested. */
  #audit-fixture { position: fixed; inset: 0; z-index: 2147483647; overflow: auto; padding: 16px; background: #fff; color: #111; font: 14px/20px sans-serif; display: grid; grid-template-columns: repeat(3, 300px); gap: 0 24px; align-content: start; }
  #audit-fixture section { position: relative; margin: 0 0 14px; min-height: 44px; min-width: 0; }
  #audit-fixture button { font: inherit; height: 28px; padding: 0 8px; border: 1px solid #555; background: #eee; white-space: nowrap; }
  #audit-fixture .card { border: 1px solid #999; padding: 4px; }
  #audit-fixture .ellipsis { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
<!-- broken -->
<section><div class="card" data-case="spills" style="width: 120px"><button style="width: 190px">A button wider than its card</button></div></section>
<section><div data-case="cut" style="width: 110px; overflow: hidden; white-space: nowrap">Words that are cut without an ellipsis</div></section>
<section><div style="width: 220px; height: 34px; overflow: hidden"><button data-case="clipped" style="margin-left: 170px; width: 130px">Half hidden</button></div></section>
<section><button data-case="overlap-a" style="position: absolute; left: 0; top: 0; width: 120px">One</button><button data-case="overlap-b" style="position: absolute; left: 80px; top: 8px; width: 120px">Two</button></section>
<section><button style="width: 90px"><span class="ellipsis" data-case="shortened">A label that is too long for it</span></button></section>
<section><button style="width: 34px"><span class="ellipsis" data-case="squeezed" style="width: 6px">model.safetensors</span></button></section>
<section><button style="position: absolute; left: 0; top: 0; width: 110px">Press</button><span data-case="text-on-control" style="position: absolute; left: 70px; top: 4px">Words over the button</span></section>
<section><span data-case="text-on-text-a" style="position: absolute; left: 0; top: 0">The first of two lines</span><span data-case="text-on-text-b" style="position: absolute; left: 40px; top: 6px">The second lies on it</span></section>
<section><div data-case="scrolls-sideways" style="width: 160px; overflow-x: auto"><div style="width: 420px">A panel that scrolls sideways because of this</div></div></section>
<section><span data-case="thumb-out" role="presentation" style="display: block; position: relative; width: 34px; height: 18px; border: 1px solid #555; border-radius: 9px"><span style="display: block; width: 14px; height: 14px; margin: 2px 0 0 26px; border-radius: 50%; background: #06c"></span></span></section>
<section><div role="dialog" data-case="outside-window" style="position: fixed; left: -60px; bottom: 8px; width: 180px; height: 40px; border: 1px solid #555; background: #fff">A dialog past the edge</div></section>
<section><button data-case="cut-down" style="height: 20px; width: 90px; overflow: hidden; white-space: normal; line-height: 18px">Two lines of words here</button></section>
<section><span data-case="raw-placeholder">Reading models: {{done}} / {{total}}</span></section>
<section><span data-case="raw-missing">Size: undefined</span></section>
<section><span data-case="raw-key">settings.mcpUrl</span></section>
<section><button data-case="raw-tooltip" title="[object Object]">Fine words, a broken tooltip</button></section>
<section><span data-case="raw-id">bbbbbbbb-0000-4000-8000-000000000002</span></section>
<section><button data-case="covered" style="position: absolute; left: 0; top: 0; width: 130px">A canvas tool</button><div class="canvas-unit" style="position: absolute; left: 24px; top: 2px; width: 150px; height: 26px; z-index: 2; background: #fc0">A note of a node</div></section>
<!-- sound -->
<section><div data-sound="scrolled-list" style="height: 40px; overflow-y: auto; border: 1px solid #999"><button style="display: block; margin: 0 0 4px">Row one</button><button style="display: block; margin: 0 0 4px">Row two, half in view</button><button style="display: block">Row three, out of view</button></div></section>
<section><button style="width: 110px"><span class="ellipsis allowed" data-sound="allowed-ellipsis">my_very_long_file_name.safetensors</span></button></section>
<section><div class="card" data-sound="overhang" style="position: relative; width: 120px; height: 30px"><span class="port-dot" style="position: absolute; right: -7px; top: 8px; width: 12px; height: 12px; border-radius: 50%; background: #c60"></span>A node</div></section>
<section><div data-sound="field-with-unit" style="position: relative; width: 140px"><input style="width: 140px; height: 28px; box-sizing: border-box" value="512"><span style="position: absolute; right: 8px; top: 4px">px</span></div></section>
<section><div data-sound="clipped-glow" class="card" style="position: relative; overflow: hidden; width: 140px"><span style="position: absolute; left: 80px; top: -10px; width: 120px; height: 60px; background: radial-gradient(#fc0, transparent)"></span>A card with a glow</div></section>
<section><div data-sound="wrapping" class="card" style="width: 150px"><button style="white-space: normal; height: auto; max-width: 100%">A button whose words wrap inside the card</button></div></section>
<section><span data-sound="thumb-in" role="presentation" style="display: block; position: relative; width: 34px; height: 18px; border: 1px solid #555; border-radius: 9px"><span style="display: block; width: 14px; height: 14px; margin: 2px 0 0 18px; border-radius: 50%; background: #06c"></span></span></section>
<section><p data-sound="paragraph-around-badge" style="width: 220px; margin: 0">A long paragraph that wraps around <b>a bold word</b> and goes on to a second and a third line of plain words.</p></section>
<section><span data-sound="file-name">Saved to settings.json and status.log</span></section>
<section><span data-sound="own-words" class="said">The person wrote {{x}}, undefined and settings.mcpUrl</span></section>
<section><span data-sound="address">Open https://docs.comfy.org/library.nodes/KSampler</span></section>
<section><div data-sound="placing-wrapper" style="width: 120px"><div style="width: 120px; border: 1px solid #999; transform: scale(1.2); transform-origin: top left">Drawn larger</div></div></section>
<section><div class="canvas-unit" style="position: absolute; left: 24px; top: 2px; width: 150px; height: 26px; background: #fc0">A note of a node</div><button data-sound="tool-on-top" style="position: absolute; left: 0; top: 0; width: 130px; z-index: 2">A canvas tool</button></section>
`;

test('the layout audit names every fault of its fixture and none of the sound layouts', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-audit-'));
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  try {
    const page = await app.firstWindow();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await page.setViewportSize({ width: 1040, height: 900 });
    await page.evaluate((html) => {
      const host = document.createElement('div');
      host.id = 'audit-fixture';
      host.innerHTML = html;
      document.body.append(host);
    }, FIXTURE);
    await page.waitForTimeout(150);

    const issues = await auditLayout(page, {
      root: '#audit-fixture', shortened: true, shortenedOk: ['.allowed'], overhang: ['.port-dot'],
      keyRoots: ['settings', 'status', 'library'], ownWords: ['.said'], units: ['.canvas-unit'],
    });
    // Which fixture case does an issue belong to? The case's own element or one inside it.
    const caseOf = (issue: LayoutIssue) => page.evaluate(({ where, text }) => {
      const cls = (el: Element) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? `.${el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')}` : ''}`;
      const path = (el: Element) => {
        const parts: string[] = [];
        let current: Element | null = el;
        for (let depth = 0; current && depth < 3; depth += 1) {
          parts.unshift(cls(current));
          current = current.parentElement;
        }
        return parts.join(' > ');
      };
      const hit = Array.from(document.querySelectorAll('#audit-fixture *')).find((el) => path(el) === where && ((el as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 70) === text);
      const owner = hit?.closest('[data-case], [data-sound]') ?? hit?.querySelector('[data-case], [data-sound]');
      return owner ? (owner.getAttribute('data-case') ?? `sound:${owner.getAttribute('data-sound')}`) : `?:${where}`;
    }, { where: issue.where, text: issue.text });
    const seen = new Map<string, Set<string>>();
    for (const issue of issues) {
      const name = await caseOf(issue);
      seen.set(name, (seen.get(name) ?? new Set()).add(issue.kind));
    }
    const report = issues.map((issue) => `[${issue.kind}] ${issue.where} "${issue.text}" ${issue.detail}`).join('\n');

    const expected: Array<[string | string[], string]> = [
      ['spills', 'spills'],
      ['cut', 'cut'],
      ['clipped', 'clipped'],
      [['overlap-a', 'overlap-b'], 'overlap'],
      ['shortened', 'shortened'],
      ['squeezed', 'squeezed'],
      ['text-on-control', 'overlap'],
      [['text-on-text-a', 'text-on-text-b'], 'overlap'],
      ['scrolls-sideways', 'scrolls-sideways'],
      ['thumb-out', 'spills'],
      ['outside-window', 'outside-window'],
      ['cut-down', 'cut'],
      ['raw-placeholder', 'raw-text'],
      ['raw-missing', 'raw-text'],
      ['raw-key', 'raw-text'],
      ['raw-tooltip', 'raw-text'],
      ['raw-id', 'raw-text'],
      ['covered', 'overlap'],
    ];
    for (const [names, kind] of expected) {
      const list = Array.isArray(names) ? names : [names];
      expect(list.some((name) => seen.get(name)?.has(kind)), `the audit must report ${kind} for ${list.join(' / ')}\n${report}`).toBe(true);
    }
    // Every case must be in view, or the checks that look at what is drawn at a point pass without looking.
    const hidden = await page.evaluate(() => Array.from(document.querySelectorAll('#audit-fixture [data-case], #audit-fixture [data-sound]'))
      .filter((el) => { const rect = el.getBoundingClientRect(); return rect.bottom > window.innerHeight || rect.top < 0; })
      .map((el) => el.getAttribute('data-case') ?? el.getAttribute('data-sound')));
    expect(hidden.filter((name) => name !== 'outside-window'), 'cases out of view').toEqual([]);
    const sound = [...seen.keys()].filter((name) => name.startsWith('sound:') || name.startsWith('?:'));
    expect(sound, `sound layouts must not be reported\n${report}`).toEqual([]);
  } finally {
    await app.close().catch(() => undefined);
  }
});
