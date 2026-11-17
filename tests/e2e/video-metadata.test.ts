/** Actual desktop file/paired browser import; sparse media payload proves frames do not cross HTTP. */
import { test, expect, chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createServer } from 'node:http';
import { launchApp } from './support/app';

test('large video metadata opens on desktop and a paired touch browser without uploading frames', async () => {
  const run = await launchApp({ english: true, viewport: { width: 1440, height: 900 } });
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const atom = (kind: string, bytes: Buffer) => { const header = Buffer.alloc(8); header.writeUInt32BE(bytes.length + 8); header.write(kind, 4, 'latin1'); return Buffer.concat([header, bytes]); };
    const workflow = { version: 0.4, last_node_id: 1, last_link_id: 0, nodes: [{ id: 1, type: 'Note', title: 'From large video', pos: [0, 0], size: [220, 100], flags: {}, order: 0, mode: 0, inputs: [], outputs: [], properties: {}, widgets_values: ['Metadata only'] }], links: [] };
    const file = path.join(run.userData, 'large.mp4'); const fd = fs.openSync(file, 'w');
    const ftyp = atom('ftyp', Buffer.from('isom0000')); const size = 128 * 1024 ** 2;
    const mdat = Buffer.alloc(8); mdat.writeUInt32BE(size); mdat.write('mdat', 4);
    fs.writeSync(fd, ftyp, 0, ftyp.length, 0); fs.writeSync(fd, mdat, 0, mdat.length, ftyp.length);
    const tail = atom('moov', atom('udta', atom('©cmt', Buffer.from(JSON.stringify({ workflow })))));
    fs.writeSync(fd, tail, 0, tail.length, ftyp.length + size); fs.closeSync(fd);
    const result = await run.page.evaluate(file => window.electronAPI.openPath(file), file);
    expect(result.status).toBe('applied');
    expect(await run.page.evaluate(() => window.electronAPI.exportWorkflowDocument())).toMatchObject({ ok: true, workflow });
    const allocator = createServer(); await new Promise<void>(done => allocator.listen(0, '127.0.0.1', done));
    const port = (allocator.address() as { port: number }).port; await new Promise<void>(done => allocator.close(() => done()));
    await run.page.evaluate(async port => {
      const settings = await window.electronAPI.getSettings(); if (settings.source === 'corrupt') throw Error('Test settings unreadable');
      await window.electronAPI.saveSettings({ ...settings.values, preferences: { browserAccess: { enabled: true, address: '127.0.0.1', port } } });
    }, port);
    await expect.poll(() => run.page.evaluate(async () => (await window.electronAPI.browserAccessStatus()).state)).toBe('listening');
    const code = await run.page.evaluate(async () => (await window.electronAPI.browserPairingCode()).code);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const origin = `http://127.0.0.1:${port}`;
    expect((await context.request.post(`${origin}/browser/pair`, { headers: { Origin: origin }, data: { code } })).status()).toBe(200);
    const phone = await context.newPage(); const errors: string[] = [];
    phone.on('pageerror', error => errors.push(error.message)); await phone.goto(origin); await expect(phone.locator('.app-shell')).toBeVisible();
    await phone.evaluate(() => {
      const original = Blob.prototype.arrayBuffer;
      (window as any).videoReadBytes = 0;
      Blob.prototype.arrayBuffer = async function () { (window as any).videoReadBytes += this.size; return original.call(this); };
    });
    let uploadBytes = 0;
    phone.on('request', request => { if (request.url().endsWith('/browser/call') && request.postDataJSON()?.method === 'browserImport') uploadBytes += request.postDataBuffer()?.length ?? 0; });
    const picker = phone.waitForEvent('filechooser'); const opening = phone.evaluate(() => window.electronAPI.importWorkflow());
    await (await picker).setFiles(file);
    expect((await opening).status).toBe('applied');
    expect(uploadBytes).toBeGreaterThan(100); expect(uploadBytes).toBeLessThan(4096);
    expect(await phone.evaluate(() => (window as any).videoReadBytes)).toBeLessThan(4096);
    expect(await phone.evaluate(() => window.electronAPI.exportWorkflowDocument())).toMatchObject({ ok: true, workflow });
    // Slow a local Blob read only, to verify cancellation never sends an import to the host.
    const before = await phone.evaluate(() => window.electronAPI.readProjection('desktop'));
    await phone.evaluate(() => { Blob.prototype.arrayBuffer = () => new Promise(() => {}); });
    const again = phone.waitForEvent('filechooser'); const cancelled = phone.evaluate(() => window.electronAPI.importWorkflow());
    await (await again).setFiles(file); await phone.evaluate(() => window.electronAPI.cancelFileOpen());
    expect((await cancelled).status).toBe('cancelled');
    expect((await phone.evaluate(() => window.electronAPI.readProjection('desktop')))!.currentRevisionId).toBe(before!.currentRevisionId);
    expect(errors).toEqual([]); expect(run.pageErrors).toEqual([]);
  } finally { await browser.close(); await run.close(); }
});
