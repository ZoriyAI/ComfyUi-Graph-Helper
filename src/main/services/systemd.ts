/** Explicit controls for discovered AI service families on the NodeWise host. Never accepts a command/path from IPC. */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { serviceActionSchema, type LocalService, type ServiceActionResult, type ServiceKind, type ServiceScope, type ServicesStatus } from '../../shared/contracts/services';

export interface CommandResult { ok: boolean; stdout: string; code?: number | string; timedOut?: boolean }
export type ServiceRunner = (file: string, args: string[], timeout: number) => Promise<CommandResult>;
const SYSTEMCTL = '/usr/bin/systemctl';
const PKEXEC = '/usr/bin/pkexec';
const PATTERNS = ['comfyui*.service', 'ollama*.service', 'llama-server*.service', 'llama-cpp*.service', 'lmstudio*.service', 'lms.service'];
const PROPERTIES = ['Id', 'LoadState', 'ActiveState', 'SubState', 'MainPID', 'MemoryCurrent', 'NRestarts', 'CanStart', 'CanStop', 'FragmentPath', 'ExecStart', 'NeedDaemonReload'];
const options = (scope: ServiceScope) => [...(scope === 'user' ? ['--user'] : []), '--no-pager', '--no-ask-password'];
const amount = (raw: string | undefined): number | null => {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw); return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

/** A narrow family allowlist, also applied after discovery and immediately before every mutation. */
export function serviceKind(unit: string): ServiceKind | null {
  if (unit.length > 200 || !/^[a-zA-Z0-9_.@-]+\.service$/.test(unit) || unit.includes('@.')) return null;
  const stem = unit.slice(0, -8).toLowerCase();
  if (/^comfyui(?:[-_.@]|$)/.test(stem)) return /(?:^|[-_.@])mcp(?:[-_.@]|$)/.test(stem) ? 'mcp' : 'comfyui';
  if (/^ollama(?:[-_.@]|$)/.test(stem)) return 'ollama';
  if (/^llama-(?:server|cpp)(?:[-_.@]|$)/.test(stem)) return 'llamacpp';
  if (/^lmstudio(?:[-_.@]|$)/.test(stem) || stem === 'lms') return 'lmstudio';
  return null;
}

const runCommand: ServiceRunner = (file, args, timeout) => new Promise(resolve => {
  execFile(file, args, { timeout, maxBuffer: 512 * 1024, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, LC_ALL: 'C', SYSTEMD_COLORS: '0', SYSTEMD_PAGER: 'cat' } }, (error, stdout) => {
    // stderr and ExecStart can contain private data. Neither is returned to the renderer or logged.
    resolve({ ok: !error, stdout: error ? '' : stdout, ...(error ? { code: error.code, timedOut: error.killed } : {}) });
  });
});

function decode(scope: ServiceScope, block: string, allowed: Set<string>): LocalService | null {
  const properties: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const at = line.indexOf('='); if (at > 0) properties[line.slice(0, at)] = line.slice(at + 1);
  }
  const unit = properties.Id;
  const kind = unit && serviceKind(unit);
  if (!kind || !allowed.has(unit) || properties.LoadState !== 'loaded') return null;
  const state = properties.ActiveState === 'active' && (amount(properties.MainPID) ?? 0) > 0 ? 'running'
    : properties.ActiveState === 'inactive' ? 'stopped' : properties.ActiveState === 'failed' ? 'failed'
      : properties.ActiveState === 'activating' || properties.ActiveState === 'reloading' ? 'starting'
        : properties.ActiveState === 'deactivating' ? 'stopping' : 'unknown';
  // Bind the user's displayed choice to the same unit definition and process state; exclude changing resource counters.
  const revision = createHash('sha256').update(JSON.stringify([scope, unit, properties.FragmentPath, properties.ExecStart,
    properties.ActiveState, properties.SubState, properties.MainPID, properties.NeedDaemonReload])).digest('hex');
  return { id: `${scope}:${unit}`, unit, scope, kind, state, revision,
    memoryBytes: amount(properties.MemoryCurrent), restarts: amount(properties.NRestarts),
    canStart: properties.CanStart === 'yes' && properties.NeedDaemonReload !== 'yes', canStop: properties.CanStop === 'yes' };
}

export class ServiceController {
  private changing = false;
  constructor(private readonly run: ServiceRunner = runCommand, private readonly platform = process.platform,
    private readonly host = hostname(), private readonly wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {}

  async status(): Promise<ServicesStatus> {
    const result: ServicesStatus = { supported: this.platform === 'linux', host: this.host, at: Date.now(), services: [], unavailableScopes: [] };
    if (!result.supported) return result;
    const scopes: ServiceScope[] = ['user', 'system'];
    const reads = await Promise.all(scopes.map(async scope => {
      try {
        const lists = await Promise.all(['list-unit-files', 'list-units'].map(command => this.run(SYSTEMCTL,
          [...options(scope), command, '--type=service', '--all', '--no-legend', '--plain', ...PATTERNS], 5000)));
        if (lists.some(item => !item.ok)) return null;
        const names = [...new Set(lists.flatMap(item => item.stdout.split('\n').map(line => line.trim().split(/\s+/)[0])).filter(name => serviceKind(name)))].sort().slice(0, 80);
        if (!names.length) return [];
        const shown = await this.run(SYSTEMCTL, [...options(scope), 'show', `--property=${PROPERTIES.join(',')}`, ...names], 5000);
        if (!shown.ok) return null;
        const allowed = new Set(names);
        return shown.stdout.split(/\n\s*\n/).flatMap(block => { const service = decode(scope, block, allowed); return service ? [service] : []; });
      } catch { return null; }
    }));
    reads.forEach((read, index) => { if (read === null) result.unavailableScopes.push(scopes[index]); else result.services.push(...read); });
    return result;
  }

  async control(input: unknown): Promise<ServiceActionResult> {
    const parsed = serviceActionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    if (this.changing) return { ok: false, error: 'busy' };
    this.changing = true;
    try {
      const before = await this.status();
      if (!before.supported) return { ok: false, error: 'unavailable', status: before };
      const { id, revision, action } = parsed.data;
      const service = before.services.find(item => item.id === id);
      if (!service || service.revision !== revision) return { ok: false, error: 'changed', status: before };
      if ((action !== 'stop' && !service.canStart) || (action !== 'start' && !service.canStop)) return { ok: false, error: 'unavailable', status: before };
      if ((action === 'start' && service.state === 'running') || (action === 'stop' && service.state === 'stopped')) return { ok: true, status: before };
      // Polkit's registered desktop dialog owns authorization. Never fall back to a terminal prompt, sudo, or a shell.
      const args = [...options(service.scope), action, service.unit];
      const command = await this.run(service.scope === 'system' ? PKEXEC : SYSTEMCTL,
        service.scope === 'system' ? ['--disable-internal-agent', SYSTEMCTL, ...args] : args, 90_000);
      let after = await this.status();
      if (!command.ok) return { ok: false,
        error: command.timedOut ? 'timeout' : service.scope === 'system' && (command.code === 126 || command.code === 127) ? 'authorization' : 'failed', status: after };
      for (let attempt = 0; attempt < 5; attempt++) {
        const observed = after.services.find(item => item.id === id);
        if (observed?.state === (action === 'stop' ? 'stopped' : 'running')) return { ok: true, status: after };
        if (observed?.state === 'failed') return { ok: false, error: 'failed', status: after };
        if (attempt < 4) { await this.wait(250); after = await this.status(); }
      }
      return { ok: false, error: 'unconfirmed', status: after };
    } catch { return { ok: false, error: 'failed' }; }
    finally { this.changing = false; }
  }
}

export const serviceController = new ServiceController();
