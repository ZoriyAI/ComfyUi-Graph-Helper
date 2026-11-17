import { describe, expect, it } from 'vitest';
import { availableRam, nvidiaGpus, systemGpus } from '../../src/main/knowledge/hostHardware';
import { hostReadiness } from '../../src/shared/knowledge/hostReadiness';
import type { HostHardwareSnapshot } from '../../src/shared/contracts/resources';
import { setupPage } from '../../src/shared/journeyLinks';

const GiB = 1024 ** 3;
const snapshot = (gpus: HostHardwareSnapshot['gpus']): HostHardwareSnapshot => ({ measuredAt: 1, platform: 'linux', arch: 'x64', cpu: { name: 'CPU', logicalCores: 8 }, ram: { total: 32 * GiB, available: 20 * GiB, availableKind: 'available' }, gpus, gpuSource: 'nvidia-smi', disk: null });
describe('host hardware facts and cautious starting points', () => {
  it('keeps cards separate instead of inventing pooled memory', () => {
    const cards = nvidiaGpus('Card A, 8192, 4096\nCard B, 8192, 4096\n');
    expect(cards).toHaveLength(2);
    expect(cards.map(card => card.free)).toEqual([4 * GiB, 4 * GiB]);
    expect(hostReadiness(snapshot(cards)).start).toBe('small');
    expect(hostReadiness(snapshot(nvidiaGpus('Card, 16384, 14336'))).start).toBe('image');
  });
  it('keeps missing or inconsistent GPU measurements unknown', () => {
    expect(nvidiaGpus('Card, [N/A], [N/A]')[0]).toMatchObject({ total: null, free: null });
    expect(nvidiaGpus('Card, 1000, 2000')[0].free).toBeNull();
    expect(hostReadiness(snapshot(nvidiaGpus('Card, [N/A], [N/A]'))).start).toBe('unknown');
    expect(nvidiaGpus('malformed\n')).toEqual([]);
  });
  it('distinguishes Linux available RAM from simply unused RAM', () => {
    expect(availableRam('MemAvailable: 1048576 kB\n', 4 * GiB, 123)).toEqual({ total: 4 * GiB, available: GiB, availableKind: 'available' });
    expect(availableRam('MemAvailable: 999999999 kB', 4 * GiB, 123)).toEqual({ total: 4 * GiB, available: 123, availableKind: 'free' });
    expect(availableRam('', 4 * GiB, 5 * GiB).available).toBe(4 * GiB);
  });
  it('does not equate shared Apple memory with dedicated VRAM', () => {
    const cards = systemGpus({ gpuDevice: [{ deviceString: 'Apple M3' }] }, 'darwin', 'arm64');
    expect(cards[0]).toEqual({ name: 'Apple M3', total: null, free: null, memoryKind: 'unified' });
    expect(hostReadiness(snapshot(cards)).start).toBe('unified');
    expect(systemGpus(null, 'linux', 'x64')).toEqual([]);
  });
  it('shows current memory pressure and low disk as separate actionable facts', () => {
    const report = snapshot(nvidiaGpus('Card, 32768, 2048'));
    report.disk = { total: 100 * GiB, available: 4 * GiB };
    expect(hostReadiness(report)).toEqual({ start: 'small', busy: true, lowDisk: true });
  });
  it('opens only the fixed official setup pages, never prototype properties or renderer URLs', () => {
    expect(setupPage('comfyui-install-manual')).toBe('https://docs.comfy.org/installation/manual_install');
    for (const invalid of ['constructor', '__proto__', 'https://example.com', null, {}]) expect(setupPage(invalid)).toBeNull();
  });
});
