import type Database from 'better-sqlite3';
import { readProjection } from '../commands/commit';
import { readCatalog } from '../catalog/repository';
import { readSettings } from '../settings/repository';
import { reportedComfyUrl } from '../mcp/sync';
import { COMFY_ROUTES, comfyGet, comfyOriginOf } from '../comfy/gate';
import { hardwareOf, readHardware, rememberHardware } from '../comfy/hardware';
import { assessGraphResources } from '../../shared/resources/assess';
import type { GraphResources } from '../../shared/contracts/resources';
export function graphResources(db: Database.Database, projectId: string): GraphResources {
  const projection = readProjection(db, projectId); if (!projection) throw Error('Project was not found.');
  const settings = readSettings(db); const origin = settings.source === 'corrupt' ? '' : settings.values.comfyOrigin || reportedComfyUrl(db) || '';
  return assessGraphResources(projection.snapshot as import('../../shared/workflow/codec').GraphSnapshot, readCatalog(db), origin ? readHardware(db, comfyOriginOf(origin)?.origin ?? '') : null);
}
export async function refreshResourceHardware(db: Database.Database, fetchImpl: typeof fetch): Promise<void> {
  const settings = readSettings(db); if (settings.source === 'corrupt') return;
  const configured = () => readSettings(db).source === 'corrupt' ? '' : (readSettings(db) as Exclude<ReturnType<typeof readSettings>, { source: 'corrupt' }>).values.comfyOrigin || reportedComfyUrl(db) || '';
  const origin = comfyOriginOf(configured()); if (!origin) return;
  const result = await comfyGet(origin, COMFY_ROUTES.systemStats(), fetchImpl);
  if (result.ok && 'json' in result && comfyOriginOf(configured())?.origin === origin.origin) rememberHardware(db, hardwareOf(origin.origin, result.json));
}
