import { modelDirectoryFor } from './modelFolders';
import type { CatalogInput, CatalogNode, CatalogOutput, CatalogView } from './types';

/** A full ComfyUI /object_info payload is large. Reject anything past 32 MiB before parse. */
export const MAX_OBJECT_INFO_BYTES = 32 * 1024 * 1024;

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);

export class ObjectInfoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectInfoError';
  }
}

export interface ParsedObjectInfo {
  nodes: CatalogNode[];
  models: Array<{ directory: string; name: string }>;
}

export function assertObjectInfoSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_OBJECT_INFO_BYTES) {
    throw new ObjectInfoError('Catalog snapshot is too large.');
  }
}

/**
 * Parse a GET /object_info document: a map of class name to NodeInfo.
 * Input specs follow ComfyUI INPUT_TYPES JSON: [type, options?] or a legacy combo [string[], options?].
 * Widget slots follow input_order required then optional.
 * control_after_generate and image_upload each add the extra widgets_values slot the frontend writes
 * (comfy.comfy_types.node_typing.InputTypeOptions).
 */
export function parseObjectInfo(document: unknown): ParsedObjectInfo {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const record = document as Record<string, unknown>;
  const nodes: CatalogNode[] = [];
  const models: Array<{ directory: string; name: string }> = [];
  const seenModels = new Set<string>();
  for (const [classType, value] of Object.entries(record)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ObjectInfoError('Catalog snapshot is not object_info.');
    }
    const info = value as Record<string, unknown>;
    const pythonModule = pythonModuleOf(info);
    const { inputs, widgetOrder } = inputsOf(info);
    const outputs = outputsOf(info);
    nodes.push({
      classType,
      pack: pythonModule,
      pythonModule,
      inputs,
      outputs,
      widgetOrder,
    });
    for (const input of inputs) {
      if (!input.widget) continue;
      const directory = modelDirectoryFor(classType, input.name);
      if (!directory) continue;
      for (const name of comboNames(info, input.name)) {
        const key = `${directory}/${name}`;
        if (seenModels.has(key)) continue;
        seenModels.add(key);
        models.push({ directory, name });
      }
    }
  }
  return { nodes, models };
}

export function widgetIndexFor(catalog: CatalogView, classType: string, key: string): number | undefined {
  const node = catalog.nodes.find((item) => item.classType === classType);
  if (!node) return undefined;
  const index = node.widgetOrder.indexOf(key);
  return index >= 0 ? index : undefined;
}

function pythonModuleOf(info: Record<string, unknown>): string {
  if (info.python_module === undefined) return 'nodes';
  if (typeof info.python_module !== 'string' || info.python_module.length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  return info.python_module;
}

function outputsOf(info: Record<string, unknown>): CatalogOutput[] {
  if (info.output === undefined) return [];
  if (!Array.isArray(info.output) || info.output.some((item) => typeof item !== 'string')) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const names = Array.isArray(info.output_name) ? info.output_name : [];
  return info.output.map((type, index) => ({
    type,
    name: typeof names[index] === 'string' ? names[index] : type,
  }));
}

function inputsOf(info: Record<string, unknown>): { inputs: CatalogInput[]; widgetOrder: string[] } {
  if (info.input !== undefined && (!info.input || typeof info.input !== 'object' || Array.isArray(info.input))) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const input = (info.input ?? {}) as Record<string, unknown>;
  const order = inputOrderOf(info.input_order);
  const inputs: CatalogInput[] = [];
  const widgetOrder: string[] = [];
  for (const group of ['required', 'optional'] as const) {
    const specs = groupSpecs(input[group]);
    const names = order[group] ?? Object.keys(specs);
    const seen = new Set<string>();
    for (const name of [...names, ...Object.keys(specs)]) {
      if (seen.has(name) || !(name in specs)) continue;
      seen.add(name);
      const spec = specs[name];
      const parsed = parseSpec(spec);
      inputs.push({ name, type: parsed.type, widget: parsed.widget });
      if (!parsed.widget) continue;
      widgetOrder.push(name);
      if (parsed.controlAfterGenerate) widgetOrder.push(`${name}::control_after_generate`);
      if (parsed.imageUpload) widgetOrder.push(`${name}::image_upload`);
    }
  }
  return { inputs, widgetOrder };
}

function inputOrderOf(value: unknown): { required?: string[]; optional?: string[] } {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const record = value as Record<string, unknown>;
  return {
    required: nameList(record.required),
    optional: nameList(record.optional),
  };
}

function nameList(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  return value;
}

function groupSpecs(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  return value as Record<string, unknown>;
}

function parseSpec(spec: unknown): { type: string; widget: boolean; controlAfterGenerate: boolean; imageUpload: boolean } {
  if (!Array.isArray(spec) || spec.length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const options = spec[1] && typeof spec[1] === 'object' && !Array.isArray(spec[1]) ? (spec[1] as Record<string, unknown>) : {};
  const forceInput = options.forceInput === true;
  if (Array.isArray(spec[0])) {
    return { type: 'COMBO', widget: !forceInput, controlAfterGenerate: options.control_after_generate === true, imageUpload: options.image_upload === true };
  }
  if (typeof spec[0] !== 'string' || spec[0].length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const widget = !forceInput && WIDGET_TYPES.has(spec[0]);
  return {
    type: spec[0],
    widget,
    controlAfterGenerate: widget && options.control_after_generate === true,
    imageUpload: widget && options.image_upload === true,
  };
}

function comboNames(info: Record<string, unknown>, inputName: string): string[] {
  const input = (info.input ?? {}) as Record<string, unknown>;
  for (const group of ['required', 'optional']) {
    const specs = input[group];
    if (!specs || typeof specs !== 'object' || Array.isArray(specs)) continue;
    const spec = (specs as Record<string, unknown>)[inputName];
    if (!Array.isArray(spec)) continue;
    if (Array.isArray(spec[0])) return spec[0].filter((item): item is string => typeof item === 'string' && item.length > 0);
    const options = spec[1];
    if (spec[0] === 'COMBO' && options && typeof options === 'object' && Array.isArray((options as { options?: unknown }).options)) {
      return (options as { options: unknown[] }).options.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  }
  return [];
}
