/** Service actions use an injected systemctl transport; these tests never control the developer's services. */
import { describe, expect, it } from 'vitest';
import { ServiceController, serviceKind, type CommandResult, type ServiceRunner } from '../../src/main/services/systemd';

function fixture(scope: 'user' | 'system' = 'user') {
  const state = { active: 'inactive', pid: '0', definition: 'original', ignore: false, fail: false, code: 0 };
  const calls: Array<{ file: string; args: string[] }> = [];
  const unit = 'comfyui-mcp-fixture.service';
  const run: ServiceRunner = async (file, args) => {
    calls.push({ file, args });
    const requestedScope = args.includes('--user') ? 'user' : 'system';
    const ok = (stdout: string): CommandResult => ({ ok: true, stdout });
    if (args.some(arg => arg === 'list-unit-files' || arg === 'list-units')) return ok(requestedScope === scope ? `${unit} enabled\nssh.service enabled\nollama@.service enabled\n` : '');
    if (args.includes('show')) return ok(`Id=${unit}\nLoadState=loaded\nActiveState=${state.active}\nSubState=${state.active === 'active' ? 'running' : 'dead'}\nMainPID=${state.pid}\nMemoryCurrent=1024\nNRestarts=0\nCanStart=yes\nCanStop=yes\nNeedDaemonReload=no\nFragmentPath=/fixture/${unit}\nExecStart=${state.definition} token=PRIVATE_FIXTURE\n`);
    if (state.code) return { ok: false, stdout: '', code: state.code };
    if (!state.ignore) {
      state.active = state.fail ? 'failed' : args.includes('stop') ? 'inactive' : 'active';
      state.pid = state.active === 'active' ? String(Number(state.pid) + 1) : '0';
    }
    return ok('');
  };
  return { controller: new ServiceController(run, 'linux', 'fixture-host', async () => {}), state, calls, unit };
}
const mutations = (f: ReturnType<typeof fixture>) => f.calls.filter(call => call.args.some(arg => ['start', 'stop', 'restart'].includes(arg)));

describe('local service lifecycle', () => {
  it('discovers inactive services and excludes unrelated services/templates without exposing arguments', async () => {
    const f = fixture(); const status = await f.controller.status();
    expect(status.services).toHaveLength(1);
    expect(status.services[0]).toMatchObject({ state: 'stopped', kind: 'mcp', memoryBytes: 1024, scope: 'user' });
    expect(JSON.stringify(status)).not.toContain('PRIVATE_FIXTURE');
    expect(serviceKind('ssh.service')).toBeNull();
    expect(serviceKind('ollama@.service')).toBeNull();
    expect(serviceKind('ollama-gpu1.service')).toBe('ollama');
    expect(serviceKind('comfyui.service;reboot')).toBeNull();
  });
  it('starts, restarts and stops the exact displayed service with observed-state confirmation', async () => {
    const f = fixture();
    for (const action of ['start', 'restart', 'stop'] as const) {
      const item = (await f.controller.status()).services[0];
      const result = await f.controller.control({ id: item.id, revision: item.revision, action });
      expect(result.ok).toBe(true);
      expect(result.status?.services[0].state).toBe(action === 'stop' ? 'stopped' : 'running');
    }
    expect(mutations(f).map(call => call.args)).toEqual(['start', 'restart', 'stop'].map(action => ['--user', '--no-pager', '--no-ask-password', action, f.unit]));
  });
  it('refuses forged, unknown and changed service identities without starting a command', async () => {
    const f = fixture(); const item = (await f.controller.status()).services[0];
    expect(await f.controller.control({ id: 'user:ssh.service', revision: item.revision, action: 'stop' })).toMatchObject({ ok: false, error: 'changed' });
    expect(await f.controller.control({ id: item.id, revision: item.revision, action: 'stop', command: 'rm' })).toMatchObject({ ok: false, error: 'invalid' });
    f.state.definition = 'changed';
    expect(await f.controller.control({ id: item.id, revision: item.revision, action: 'start' })).toMatchObject({ ok: false, error: 'changed' });
    expect(mutations(f)).toHaveLength(0);
  });
  it('never equates command success with the requested running state', async () => {
    const f = fixture(); f.state.ignore = true;
    const item = (await f.controller.status()).services[0];
    expect(await f.controller.control({ id: item.id, revision: item.revision, action: 'start' })).toMatchObject({ ok: false, error: 'unconfirmed' });
    f.state.ignore = false; f.state.fail = true;
    expect(await f.controller.control({ id: item.id, revision: item.revision, action: 'start' })).toMatchObject({ ok: false, error: 'failed' });
  });
  it('uses only fixed privileged arguments and reports a cancelled OS authorization', async () => {
    const f = fixture('system'); const item = (await f.controller.status()).services[0]; f.state.code = 126;
    expect(await f.controller.control({ id: item.id, revision: item.revision, action: 'start' })).toMatchObject({ ok: false, error: 'authorization' });
    expect(mutations(f)[0]).toEqual({ file: '/usr/bin/pkexec', args: ['--disable-internal-agent', '/usr/bin/systemctl', '--no-pager', '--no-ask-password', 'start', f.unit] });
  });
  it('serializes mutations so concurrent callers cannot race a restart/stop', async () => {
    const f = fixture(); const item = (await f.controller.status()).services[0];
    const first = f.controller.control({ id: item.id, revision: item.revision, action: 'start' });
    expect(await f.controller.control({ id: item.id, revision: item.revision, action: 'stop' })).toMatchObject({ ok: false, error: 'busy' });
    expect((await first).ok).toBe(true);
  });
  it('reports unavailable scopes and never claims a missing service is stopped', async () => {
    const controller = new ServiceController(async () => ({ ok: false, stdout: '' }), 'linux', 'fixture');
    expect(await controller.status()).toMatchObject({ services: [], unavailableScopes: ['user', 'system'] });
    expect(await controller.control({ id: 'user:comfyui.service', revision: '0'.repeat(64), action: 'stop' })).toMatchObject({ ok: false, error: 'changed' });
  });
  it('does not run Linux commands on another platform', async () => {
    let calls = 0;
    const controller = new ServiceController(async () => { calls++; throw Error('must not run'); }, 'win32', 'fixture');
    expect((await controller.status()).supported).toBe(false);
    expect(await controller.control({ id: 'system:ollama.service', revision: '0'.repeat(64), action: 'start' })).toMatchObject({ ok: false, error: 'unavailable' });
    expect(calls).toBe(0);
  });
});
