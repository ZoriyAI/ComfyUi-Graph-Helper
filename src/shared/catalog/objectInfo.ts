import { modelDirectoryFor } from './modelFolders';
import type { CatalogInput, CatalogNode, CatalogOutput, CatalogView } from './types';

/** A full ComfyUI /object_info payload is large. Reject anything past 32 MiB before parse. */
export const MAX_OBJECT_INFO_BYTES = 32 * 1024 * 1024;

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);
/**
 * Frontend widget constructors whose widgets_values layout is not reproduced here.
 * ComfyUI_frontend src/scripts/widgets.ts @98700cfc (ComfyWidgets keys beyond the five scalars).
 */
const OPAQUE_WIDGET_TYPES = new Set([
  'MARKDOWN',
  'IMAGEUPLOAD',
  'COLOR',
  'IMAGECOMPARE',
  'BOUNDING_BOX',
  'CHART',
  'GALLERIA',
  'PAINTER',
  'TEXTAREA',
  'CURVE',
  'RANGE',
  'BOUNDING_BOXES',
  'COLORS',
]);
/** control_after_generate enum from nodeDefSchema.ts CONTROL_OPTIONS @98700cfc. */
const CONTROL_MODES = new Set(['fixed', 'increment', 'decrement', 'randomize']);

export class ObjectInfoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectInfoError';
  }
}

export interface ParsedObjectInfo {
  nodes: CatalogNode[];
  models: Array<{ directory: string; name: string }>;
  skipped: string[];
}

export function assertObjectInfoSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_OBJECT_INFO_BYTES) {
    throw new ObjectInfoError('Catalog snapshot is too large.');
  }
}

/**
 * Parse a GET /object_info document: a map of class name to NodeInfo.
 * Input specs follow ComfyUI INPUT_TYPES JSON: [type, options?] or a legacy combo [string[], options?].
 * Widget slots follow input_order required then optional, matching ComfyUI_frontend @98700cfc:
 * - litegraphService.addInputWidget: constructor type is widgetType ?? type
 * - useIntWidget: INT control_after_generate, and seed/noise_seed when the field is omitted; one extra slot
 * - useFloatWidget: FLOAT control_after_generate only; one extra slot (addValueControlWidget, addFilterList false)
 * - useComboWidget addComboWidget: ordinary combo calls addValueControlWidgets with no options,
 *   so widgets.ts adds control_after_generate and control_filter_list. multi_select is not that path.
 * - useStringWidget / useBooleanWidget do not add a control widget
 * - LGraphNode.serialize keeps a widget unless widget.serialize === false; the flag on options does not drop these slots
 * One invalid node def is skipped. A non-object root is rejected. If every node is skipped, the snapshot is rejected.
 */
export function parseObjectInfo(document: unknown): ParsedObjectInfo {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const record = document as Record<string, unknown>;
  const nodes: CatalogNode[] = [];
  const models: Array<{ directory: string; name: string }> = [];
  const skipped: string[] = [];
  const seenModels = new Set<string>();
  for (const [classType, value] of Object.entries(record)) {
    try {
      const node = parseNode(classType, value);
      nodes.push(node);
      for (const input of node.inputs) {
        if (!input.widget || !WIDGET_TYPES.has(input.type)) continue;
        const directory = modelDirectoryFor(classType, input.name);
        if (!directory) continue;
        for (const name of comboNames(value as Record<string, unknown>, input.name)) {
          const key = `${directory}/${name}`;
          if (seenModels.has(key)) continue;
          seenModels.add(key);
          models.push({ directory, name });
        }
      }
    } catch (error) {
      if (error instanceof ObjectInfoError) {
        skipped.push(classType);
        continue;
      }
      throw error;
    }
  }
  if (nodes.length === 0 && skipped.length > 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  return { nodes, models, skipped };
}

export function widgetIndexFor(catalog: CatalogView, classType: string, key: string): number | undefined {
  const node = catalog.nodes.find((item) => item.classType === classType);
  if (!node || node.widgetOrderReliable === false) return undefined;
  const index = node.widgetOrder.indexOf(key);
  return index >= 0 ? index : undefined;
}

function parseNode(classType: string, value: unknown): CatalogNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const info = value as Record<string, unknown>;
  const pythonModule = pythonModuleOf(info);
  const { inputs, widgetOrder, widgetOrderReliable } = inputsOf(info);
  return {
    classType,
    pack: pythonModule,
    pythonModule,
    inputs,
    outputs: outputsOf(info),
    widgetOrder: widgetOrderReliable ? widgetOrder : [],
    widgetOrderReliable,
  };
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
  if (!Array.isArray(info.output)) throw new ObjectInfoError('Catalog snapshot is not object_info.');
  const names = Array.isArray(info.output_name) ? info.output_name : [];
  return info.output.map((item, index) => {
    const type = outputTypeOf(item);
    return { type, name: typeof names[index] === 'string' ? names[index] : type };
  });
}

/** zComfyOutputTypesSpec: each output is a string or a string[] combo list. */
function outputTypeOf(item: unknown): string {
  if (typeof item === 'string' && item.length > 0) return item;
  if (Array.isArray(item) && item.every((part) => typeof part === 'string')) return 'COMBO';
  throw new ObjectInfoError('Catalog snapshot is not object_info.');
}

function inputsOf(info: Record<string, unknown>): { inputs: CatalogInput[]; widgetOrder: string[]; widgetOrderReliable: boolean } {
  if (info.input !== undefined && (!info.input || typeof info.input !== 'object' || Array.isArray(info.input))) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const input = (info.input ?? {}) as Record<string, unknown>;
  const order = inputOrderOf(info.input_order);
  const inputs: CatalogInput[] = [];
  const widgetOrder: string[] = [];
  let widgetOrderReliable = true;
  for (const group of ['required', 'optional'] as const) {
    const specs = groupSpecs(input[group]);
    const names = order[group] ?? Object.keys(specs);
    const seen = new Set<string>();
    for (const name of [...names, ...Object.keys(specs)]) {
      if (seen.has(name) || !(name in specs)) continue;
      seen.add(name);
      const parsed = parseSpec(name, specs[name]);
      if (parsed.opaque) widgetOrderReliable = false;
      inputs.push({ name, type: parsed.type, widget: parsed.widget });
      if (!parsed.widget) continue;
      widgetOrder.push(name);
      if (parsed.controlAfterGenerate) widgetOrder.push(`${name}::control_after_generate`);
      if (parsed.controlFilterList) widgetOrder.push(`${name}::control_filter_list`);
      if (parsed.mediaUpload) widgetOrder.push(`${name}::media_upload`);
    }
  }
  return { inputs, widgetOrder, widgetOrderReliable };
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

function parseSpec(name: string, spec: unknown): {
  type: string;
  widget: boolean;
  opaque: boolean;
  controlAfterGenerate: boolean;
  controlFilterList: boolean;
  mediaUpload: boolean;
} {
  if (!Array.isArray(spec) || spec.length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const options = spec[1] && typeof spec[1] === 'object' && !Array.isArray(spec[1]) ? (spec[1] as Record<string, unknown>) : {};
  const forceInput = options.forceInput === true;
  if (Array.isArray(spec[0])) return describeInput('COMBO', options, forceInput, name);
  if (typeof spec[0] !== 'string' || spec[0].length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  return describeInput(spec[0], options, forceInput, name);
}

/** Link type stays the object_info type. The widget constructor is widgetType ?? that type. */
function describeInput(linkType: string, options: Record<string, unknown>, forceInput: boolean, name: string) {
  const constructorType = widgetConstructorType(linkType, options);
  const opaque = !forceInput && isOpaqueWidgetType(constructorType);
  const widget = !forceInput && (WIDGET_TYPES.has(constructorType) || opaque);
  const controlAfterGenerate = widget && !opaque && hasControlAfterGenerate(constructorType, name, options);
  const ordinaryCombo = constructorType === 'COMBO' && options.multi_select !== true;
  return {
    type: linkType,
    widget,
    opaque,
    controlAfterGenerate,
    controlFilterList: controlAfterGenerate && ordinaryCombo,
    mediaUpload: widget && !opaque && constructorType === 'COMBO' && isMediaUpload(options),
  };
}

function widgetConstructorType(linkType: string, options: Record<string, unknown>): string {
  const override = options.widgetType;
  return typeof override === 'string' && override.length > 0 ? override : linkType;
}

function isOpaqueWidgetType(type: string): boolean {
  return OPAQUE_WIDGET_TYPES.has(type) || /^COMFY_.*_V3$/.test(type);
}

/**
 * Control widgets exist only on INT, FLOAT, and COMBO constructors @98700cfc.
 * INT: control_after_generate ?? seed/noise_seed (useIntWidget).
 * FLOAT and COMBO: only a truthy control_after_generate (useFloatWidget / useComboWidget).
 * STRING and BOOLEAN constructors never add one.
 * The field is boolean or fixed|increment|decrement|randomize (CONTROL_OPTIONS).
 */
function hasControlAfterGenerate(type: string, name: string, options: Record<string, unknown>): boolean {
  if (type !== 'INT' && type !== 'FLOAT' && type !== 'COMBO') return false;
  const value = options.control_after_generate;
  if (value === true || (typeof value === 'string' && CONTROL_MODES.has(value))) return true;
  if (value !== undefined) return false;
  return type === 'INT' && (name === 'seed' || name === 'noise_seed');
}

/** nodeDefSchema.ts isMediaUploadComboInput @98700cfc. */
function isMediaUpload(options: Record<string, unknown>): boolean {
  return options.image_upload === true || options.video_upload === true || options.animated_image_upload === true;
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
