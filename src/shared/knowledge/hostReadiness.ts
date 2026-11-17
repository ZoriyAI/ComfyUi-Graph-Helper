/** Starting points, not a benchmark. Missing hardware facts never become a positive execution verdict. */
import type { HostHardwareSnapshot } from '../contracts/resources';
export function hostReadiness(snapshot: HostHardwareSnapshot): { start: 'image' | 'small' | 'unified' | 'unknown'; busy: boolean; lowDisk: boolean } {
  const dedicated = snapshot.gpus.filter(gpu => gpu.memoryKind === 'dedicated');
  const largestFree = Math.max(0, ...dedicated.map(gpu => gpu.free ?? 0));
  const known = dedicated.some(gpu => gpu.free !== null);
  return {
    start: known ? largestFree >= 6 * 1024 ** 3 ? 'image' : 'small' : snapshot.gpus.some(gpu => gpu.memoryKind === 'unified') ? 'unified' : 'unknown',
    busy: dedicated.some(gpu => gpu.total !== null && gpu.free !== null && gpu.free < gpu.total / 4),
    lowDisk: snapshot.disk !== null && snapshot.disk.available < 10 * 1024 ** 3,
  };
}
