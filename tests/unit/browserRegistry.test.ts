/** The HTTP allowlist reaches domain validation without bypassing the desktop sender guard. */
import { describe, expect, it } from 'vitest';
import { BrowserPeer } from '../../src/main/browser/server';
import { captureBrowserHandler, invokeBrowserMethod, browserChanged, onBrowserEvent } from '../../src/main/browser/registry';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { guardHandler, setTrustedAppUrl, UNTRUSTED_SENDER_ERROR } from '../../src/main/ipc/guard';

const peer = () => new BrowserPeer({ id: 'fixture', name: 'Fixture', pairedAt: 1 }, () => true);

describe('browser operation boundary', () => {
  it('captures the domain handler before wrappers while refusing the same request from a foreign desktop frame', async () => {
    const operation = (_event: unknown, project: string) => { if (project !== 'desktop') throw new Error('project'); return { project }; };
    const first = guardHandler(operation, IPC_CHANNELS.COMMAND_READ_PROJECTION);
    guardHandler(first, IPC_CHANNELS.COMMAND_READ_PROJECTION);
    setTrustedAppUrl('app://bundle/index.html');
    expect(() => first({ senderFrame: { url: 'https://example.invalid' } } as any, 'desktop')).toThrow(UNTRUSTED_SENDER_ERROR);
    expect(await invokeBrowserMethod('readProjection', ['desktop'], peer())).toEqual({ project: 'desktop' });
    await expect(invokeBrowserMethod('readProjection', ['other-project'], peer())).rejects.toThrow();
    await expect(invokeBrowserMethod('openPath', ['/etc/passwd'], peer())).rejects.toThrow();
  });
  it('preserves host-only network configuration even when an authorized phone saves preferences', async () => {
    captureBrowserHandler(IPC_CHANNELS.SETTINGS_SAVE, (_event, input) => input);
    const result = await invokeBrowserMethod('saveSettings', [{ preferences: { canvas: { gridSize: 24 }, browserAccess: { enabled: false, port: 1234 } } }], peer());
    expect(result).toEqual({ preferences: { canvas: { gridSize: 24 } } });
  });
  it('coalesces streamed refreshes while retaining a knowledge change', async () => {
    const events: unknown[] = [];
    const off = onBrowserEvent((channel, payload) => { if (channel === 'browser:refresh') events.push(payload); });
    try {
      browserChanged(); browserChanged(true); browserChanged();
      await new Promise((done) => setTimeout(done, 180));
      expect(events).toEqual([{ knowledgeChanged: true }]);
    } finally { off(); }
  });
  it('does not let a browser supply model keys through the runtime configuration method', async () => {
    captureBrowserHandler(IPC_CHANNELS.LLM_SET_CONFIG, (_event, config) => config);
    const result = await invokeBrowserMethod('llmSetConfig', [{ provider: 'local', model: 'fixture', baseURL: 'http://127.0.0.1:1234', apiKey: 'private-fixture' }], peer());
    expect(result).toEqual({ provider: 'local', model: 'fixture', baseURL: 'http://127.0.0.1:1234' });
  });
});
