/** Sanitized hardware facts from an already-authorized /system_stats read. No argv or host files retained. */
import type Database from 'better-sqlite3';
import type { HardwareSnapshot } from '../../shared/contracts/resources';
export function hardwareOf(origin: string, value: unknown, now = Date.now()): HardwareSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { system?: Record<string, unknown>; devices?: Array<Record<string, unknown>> }; if (!raw.system || typeof raw.system !== 'object' || Array.isArray(raw.system)) return null;
  const bytes = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  return { origin, measuredAt: now, ramTotal: bytes(raw.system.ram_total), ramFree: bytes(raw.system.ram_free), devices: (Array.isArray(raw.devices) ? raw.devices : []).slice(0, 32).filter(d => d && typeof d === 'object' && !Array.isArray(d)).map((d) => ({ name: typeof d.name === 'string' ? d.name.slice(0, 160) : '', type: typeof d.type === 'string' ? d.type.slice(0, 30) : '', total: bytes(d.vram_total), free: bytes(d.vram_free) })) };
}
export function rememberHardware(db: Database.Database, snapshot: HardwareSnapshot | null): void {
  if (snapshot) db.prepare("INSERT INTO sync_state(key,value) VALUES ('hardware_snapshot',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(snapshot));
}
export function readHardware(db: Database.Database, origin?: string): HardwareSnapshot | null {
  const row = db.prepare("SELECT value FROM sync_state WHERE key='hardware_snapshot'").get() as { value: string } | undefined;
  try { const value = row ? JSON.parse(row.value) as HardwareSnapshot : null; return value && typeof value.measuredAt === 'number' && Array.isArray(value.devices) && (!origin || value.origin === origin) ? value : null; } catch { return null; }
}
