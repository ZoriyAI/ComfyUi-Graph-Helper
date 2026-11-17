import { promotedWidgetPairs, promotedWidgetValue } from '../workflow/promotedWidgets';
/** File sizes are a reference, not VRAM usage. Offloading, quantization, activations and runtime sharing vary. */
import type { CatalogView } from '../catalog/types';
import type { GraphResources, HardwareSnapshot } from '../contracts/resources';
import type { GraphSnapshot } from '../workflow/codec';
import { canvasModelRefs } from '../graph/compatibility';
import { editorKind } from '../workflow/comfyLook';
import { SUBGRAPH_INPUT_NODE_ID } from '../graph/subgraphs';

export function assessGraphResources(snapshot: GraphSnapshot, catalog: CatalogView, hardware: HardwareSnapshot | null, now = Date.now()): GraphResources {
  const definitions = snapshot.subgraphs ?? []; const byId = new Map(definitions.filter((d) => !d.opaque).map((d) => [d.id, d]));
  const present = new Map(catalog.models.map((m) => [`${m.directory}/${m.name}`, m])); const known = new Set(catalog.nodeTypes);
  const models = new Map<string, GraphResources['models'][number]>(); const missingClasses = new Set<string>(); const external = new Set<string>();
  const stages: GraphResources['stages'] = []; const resolution = { width: 0, height: 0, frames: 1, batch: 1 }; const reasons: string[] = [];
  const walk = (nodes: Array<Record<string, any>>, path: string[], stack: Set<string>) => {
    for (const node of nodes) {
      if (node.data?.comfy?.mode === 2) continue;
      const type = String(node.data?.comfyType ?? ''); const definition = byId.get(type);
      if (definition) {
        if (stack.has(type)) { reasons.push('recursive-definition'); continue; }
        const inner = structuredClone(definition.nodes);
        const proxies = promotedWidgetPairs(node.data); const values = proxies.map((_, index) => promotedWidgetValue(node.data, index).value);
        if (Array.isArray(proxies) && Array.isArray(values)) proxies.forEach((pair, index) => {
          if (!Array.isArray(pair) || index >= values.length || values[index] == null) return;
          const targets = String(pair[0]) === '-1'
            ? definition.edges.filter((e) => e.source === SUBGRAPH_INPUT_NODE_ID && e.sourceHandle === `out-${definition.inputs.findIndex((p) => p.name === pair[1])}`).map((e) => ({ id: e.target, handle: e.targetHandle }))
            : [{ id: String(pair[0]), key: String(pair[1]) }];
          for (const target of targets) { const child = inner.find((n) => String(n.id) === target.id); if (!child) continue; const key = 'key' in target ? target.key : child.data.inputs.find((p: { id: string }) => p.id === target.handle)?.name; if (key) child.data.parameters = { ...child.data.parameters, [key]: values[index] }; }
        });
        walk(inner, [...path, definition.id], new Set([...stack, type])); continue;
      }
      if (!type || editorKind(type)) continue;
      if (!known.has(type)) missingClasses.add(type);
      const parameters = { ...(node.data.parameters ?? {}) }; const values = node.data.comfy?.widgets_values;
      const spec = catalog.nodes.find((c) => c.classType === type);
      if (spec?.widgetOrderReliable !== false && Array.isArray(values)) spec?.widgetOrder.forEach((key, index) => { if (!(key in parameters)) parameters[key] = values[index]; });
      const refs = canvasModelRefs({ data: { ...node.data, parameters } }, catalog);
      const identity = [...path, String(node.id)].join('/');
      for (const ref of refs) { const key = `${ref.directory}/${ref.name}`; const file = present.get(key); const existing = models.get(key); if (existing) existing.nodes.push(identity); else models.set(key, { ...ref, sizeBytes: file?.sizeBytes ?? null, nodes: [identity] }); }
      if (/ollama|embedding|llm|gemini|api/i.test(type)) external.add(type);
      if (refs.length || /sampl|video|ollama|llm/i.test(type)) stages.push({ nodeId: String(node.id), title: String(node.data.title || type), classType: type, ...(path.length ? { subgraphId: path.at(-1) } : {}), models: refs.map((ref) => `${ref.directory}/${ref.name}`) });
      for (const [field, target] of [['width', 'width'], ['height', 'height'], ['length', 'frames'], ['frames', 'frames'], ['batch_size', 'batch']] as const) { const value = parameters[field]; if (typeof value === 'number' && Number.isFinite(value) && value > 0) resolution[target] = Math.max(resolution[target], value); }
    }
  };
  walk(snapshot.nodes, [], new Set());
  const rows = [...models.values()]; const missingModels = rows.filter((m) => !present.has(`${m.directory}/${m.name}`)).map(({ directory, name }) => ({ directory, name }));
  const total = rows.reduce((sum, m) => sum + (m.sizeBytes ?? 0), 0); const largest = Math.max(0, ...rows.map((m) => m.sizeBytes ?? 0)); const unknown = rows.filter((m) => m.sizeBytes == null).length;
  if (rows.length > 1) reasons.push('multiple-models'); if (unknown) reasons.push('unknown-weight-sizes'); if (external.size) reasons.push('external-runtime');
  if (!hardware) reasons.push('hardware-unknown'); else if (now - hardware.measuredAt > 60_000) reasons.push('hardware-stale');
  const accelerators = hardware?.devices.filter((d) => d.type !== 'cpu') ?? [];
  const freeKnown = accelerators.length ? accelerators.some((d) => d.free != null) : hardware?.ramFree != null;
  const free = accelerators.length ? Math.max(0, ...accelerators.map((d) => d.free ?? 0)) : hardware?.ramFree ?? 0;
  if (freeKnown && largest > free) reasons.push('largest-weight-exceeds-free');
  if (freeKnown && total > free) reasons.push('combined-weights-exceed-free');
  if (resolution.width * resolution.height * resolution.frames * resolution.batch > 2048 * 2048 * 16) reasons.push('large-tensors');
  if (hardware?.ramFree && total > hardware.ramFree) reasons.push('weights-exceed-free-ram');
  const verdict: GraphResources['verdict'] = missingModels.length || missingClasses.size ? 'blocked' : reasons.some((r) => /exceed|large-tensors/.test(r)) ? 'risk' : !hardware || unknown || !rows.length || external.size || !free || now - hardware.measuredAt > 60_000 ? 'unknown' : 'within-reference';
  return { assessedAt: now, hardware, verdict, models: rows, missingModels, missingClasses: [...missingClasses].sort(), totalWeightFileBytes: total, largestWeightFileBytes: largest, unknownSizes: unknown, stages, resolution, unknownRuntimeModels: [...external], reasons };
}
