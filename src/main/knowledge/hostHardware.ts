/** Read-only host diagnosis. Fixed commands, bounded output and no server or model dependency. */
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { readFile, statfs } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { HostHardwareSnapshot } from '../../shared/contracts/resources';

const execute = promisify(execFile);
const cleanName = (value: unknown) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 180) : '';
const bytesFromMiB = (value: string): number | null => {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const bytes = Number(value) * 1024 ** 2;
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
};
/** Preserve per-card measurements; two GPUs do not automatically share their memory. */
export function nvidiaGpus(csv: string): HostHardwareSnapshot['gpus'] {
  return csv.split(/\r?\n/).flatMap(line => {
    const parts = line.split(',').map(part => part.trim());
    if (parts.length !== 3 || !cleanName(parts[0])) return [];
    const total = bytesFromMiB(parts[1]), free = bytesFromMiB(parts[2]);
    return [{ name: cleanName(parts[0]), total: total && total > 0 ? total : null, free: total && free !== null && free <= total ? free : null, memoryKind: 'dedicated' as const }];
  }).slice(0, 16);
}
export function availableRam(meminfo: string, total: number, fallback: number): HostHardwareSnapshot['ram'] {
  const match = /^MemAvailable:\s+(\d+)\s+kB\s*$/m.exec(meminfo);
  const available = match ? Number(match[1]) * 1024 : NaN;
  return Number.isSafeInteger(available) && available >= 0 && available <= total
    ? { total, available, availableKind: 'available' }
    : { total, available: Math.max(0, Math.min(total, fallback)), availableKind: 'free' };
}
/** Electron's portable report often names a GPU without exposing its memory. Unknown remains unknown. */
export function systemGpus(info: unknown, platform: string, arch: string): HostHardwareSnapshot['gpus'] {
  if (!info || typeof info !== 'object') return [];
  const devices = (info as { gpuDevice?: unknown }).gpuDevice;
  if (!Array.isArray(devices)) return [];
  return devices.flatMap(device => {
    if (!device || typeof device !== 'object') return [];
    const name = cleanName(device.deviceString) || cleanName(device.driverVendor);
    if (!name) return [];
    return [{ name, total: null, free: null, memoryKind: platform === 'darwin' && arch === 'arm64' ? 'unified' as const : 'unknown' as const }];
  }).slice(0, 16);
}
async function boundedGpuInfo(read: () => Promise<unknown>): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([read(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 4000); timer.unref?.(); })]); }
  catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}
/** Cache also coalesces phone and desktop requests so refreshing cannot spawn overlapping probes. */
export function createHostHardwareReader(dataPath: string, gpuInfo: () => Promise<unknown>): () => Promise<HostHardwareSnapshot> {
  let cached: HostHardwareSnapshot | null = null;
  let pending: Promise<HostHardwareSnapshot> | null = null;
  const probe = async (): Promise<HostHardwareSnapshot> => {
    const platform = os.platform(), arch = os.arch();
    const [csv, system, memory, disk] = await Promise.all([
      execute('nvidia-smi', ['--query-gpu=name,memory.total,memory.free', '--format=csv,noheader,nounits'], { timeout: 4000, maxBuffer: 64 * 1024, windowsHide: true }).then(result => result.stdout).catch(() => ''),
      boundedGpuInfo(gpuInfo),
      platform === 'linux' ? readFile('/proc/meminfo', 'utf8').catch(() => '') : Promise.resolve(''),
      statfs(dataPath).then(fs => ({ total: fs.blocks * fs.bsize, available: fs.bavail * fs.bsize })).catch(() => null),
    ]);
    const nvidia = nvidiaGpus(csv), fallback = systemGpus(system, platform, arch), cpus = os.cpus();
    return {
      measuredAt: Date.now(), platform, arch, cpu: { name: cleanName(cpus[0]?.model), logicalCores: cpus.length },
      ram: availableRam(memory, os.totalmem(), os.freemem()),
      gpus: nvidia.length ? nvidia : fallback,
      gpuSource: nvidia.length ? 'nvidia-smi' : fallback.length ? 'system' : 'unavailable',
      disk: disk && Number.isSafeInteger(disk.total) && Number.isSafeInteger(disk.available) && disk.total > 0 && disk.available >= 0 ? disk : null,
    };
  };
  return () => {
    if (pending) return pending;
    if (cached && Date.now() - cached.measuredAt < 10_000) return Promise.resolve(cached);
    pending = probe().then(value => { cached = value; return value; }).finally(() => { pending = null; });
    return pending;
  };
}
