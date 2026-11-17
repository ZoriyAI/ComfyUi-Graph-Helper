/**
 * Reads ComfyUI's GET /object_info answer into the app's catalog: every node class with its inputs, outputs and the
 * widgets_values slot order, plus the model files the core loaders list. Main parses it when it syncs from a server
 * or a file (main/catalog/repository.ts, main/comfy, main/mcp/client.ts); workflow/codec.ts and the command code use
 * the slot helpers. The slot rules copy ComfyUI's frontend, because a workflow file stores widget values by position.
 */
import { modelDirectoryFor } from './modelFolders';
import type { CatalogInput, CatalogLayout, CatalogNode, CatalogOutput, CatalogView } from './types';

/** The scalar widget types; only these can hold a model file name. */
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

/** A document that is not object_info, or one node definition in it that is broken. */
export class ObjectInfoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectInfoError';
  }
}

/** The parsed catalog; `skipped` names node classes whose definition could not be read. */
export interface ParsedObjectInfo {
  nodes: CatalogNode[];
  models: Array<{ directory: string; name: string }>;
  skipped: string[];
}

/**
 * The largest object_info the app reads, from a server or a file: several times any real install (a large one is
 * tens of MB). Parsing takes about four times the size in memory and holds the app meanwhile, so a larger cap only
 * let a broken or hostile answer freeze the window. It also stops an endless answer from filling memory.
 */
export const OBJECT_INFO_MAX_BYTES = 128 * 1024 * 1024;

/** Refuses a nonsense size and one above OBJECT_INFO_MAX_BYTES. */
export function assertObjectInfoSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > OBJECT_INFO_MAX_BYTES) {
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

/** Position of a widget in widgets_values, or undefined when the class's slot order is unknown or unreliable. */
export function widgetIndexFor(catalog: CatalogView, classType: string, key: string): number | undefined {
  const node = catalog.nodes.find((item) => item.classType === classType);
  if (!node || node.widgetOrderReliable === false) return undefined;
  const index = node.widgetOrder.indexOf(key);
  return index >= 0 ? index : undefined;
}

/** One node definition; throws ObjectInfoError when its shape is wrong, so only that node is skipped. */
function parseNode(classType: string, value: unknown): CatalogNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const info = value as Record<string, unknown>;
  const pythonModule = pythonModuleOf(info);
  const { inputs, widgetOrder, widgetOrderReliable } = inputsOf(info);
  if (info.is_input_list === true) for (const input of inputs) input.isList = true;
  // Core audio adds its chooser in the frontend extension, outside INPUT_TYPES. It adds no serialized slot.
  if (classType === 'LoadAudio') for (const input of inputs) if (input.widget && input.name === 'audio') { input.mediaUpload = true; input.mediaType = 'audio'; }
  return {
    classType,
    pack: pythonModule,
    pythonModule,
    ...optionalText(info),
    outputNode: info.output_node === true,
    ...(info.api_node === true ? { apiNode: true } : {}),
    ...(info.deprecated === true ? { deprecated: true } : {}),
    ...(info.experimental === true ? { experimental: true } : {}),
    inputs,
    outputs: outputsOf(info),
    widgetOrder: widgetOrderReliable ? widgetOrder : [],
    widgetOrderReliable,
  };
}

/** display_name, category, description are informative only; a wrong type is dropped, not fatal. */
function optionalText(info: Record<string, unknown>): { displayName?: string; category?: string; description?: string } {
  const out: { displayName?: string; category?: string; description?: string } = {};
  if (typeof info.display_name === 'string' && info.display_name !== '') out.displayName = info.display_name;
  if (typeof info.category === 'string' && info.category !== '') out.category = info.category;
  if (typeof info.description === 'string' && info.description !== '') out.description = info.description;
  return out;
}

/** The node's Python module: missing means a core node ('nodes'), as ComfyUI's own server reports it. */
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
    const matchType = Array.isArray(info.output_matchtypes) ? info.output_matchtypes[index] : undefined;
    return { type: type === 'COMFY_MATCHTYPE_V3' ? '*' : type, name: typeof names[index] === 'string' ? names[index] : type,
      ...(Array.isArray(info.output_is_list) && info.output_is_list[index] === true ? { isList: true } : {}),
      ...(typeof matchType === 'string' && matchType ? { matchType } : {}),
    };
  });
}

/** zComfyOutputTypesSpec: each output is a string or a string[] combo list. */
function outputTypeOf(item: unknown): string {
  if (typeof item === 'string' && item.length > 0) return item;
  if (Array.isArray(item) && item.every((part) => typeof part === 'string')) return 'COMBO';
  throw new ObjectInfoError('Catalog snapshot is not object_info.');
}

/** The inputs in input_order (then any not listed there), and the widgets_values slots they make. */
function inputsOf(info: Record<string, unknown>, depth = 0): CatalogLayout & { widgetOrderReliable: boolean } {
  if (depth > 8) throw new ObjectInfoError('Dynamic input nesting is too deep.');
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
      const dynamic = dynamicSpec(name, specs[name], group === 'required', depth);
      if (dynamic) {
        inputs.push(dynamic);
        if (dynamic.widget) widgetOrder.push(name);
        continue;
      }
      const parsed = parseSpec(name, specs[name]);
      if (parsed.opaque) widgetOrderReliable = false;
      const entry: CatalogInput = { name, type: parsed.type, widget: parsed.widget, required: group === 'required' };
      if (parsed.default !== undefined) entry.default = parsed.default;
      if (parsed.options) entry.options = parsed.options;
      if (parsed.controlDefault !== undefined) entry.controlDefault = parsed.controlDefault;
      if (parsed.mediaUpload) entry.mediaUpload = true;
      Object.assign(entry, parsed.meta);
      inputs.push(entry);
      if (!parsed.widget) continue;
      widgetOrder.push(name);
      if (parsed.controlAfterGenerate) widgetOrder.push(`${name}::control_after_generate`);
      if (parsed.controlFilterList) widgetOrder.push(`${name}::control_filter_list`);
      if (parsed.mediaUpload) widgetOrder.push(`${name}::media_upload`);
    }
  }
  return { inputs, widgetOrder, widgetOrderReliable };
}

/** Parse only server-declared native behaviour. Unknown frontend widgets retain the opaque fallback. */
function dynamicSpec(name: string, spec: unknown, required: boolean, depth: number): CatalogInput | undefined {
  if (!Array.isArray(spec) || !String(spec[0]).startsWith('COMFY_')) return undefined;
  const options = groupSpecs(spec[1]);
  const base = { name, required, ...(typeof options.tooltip === 'string' ? { tooltip: options.tooltip } : {}) };
  const layout = (input: unknown) => inputsOf({ input }, depth + 1);
  const count = (value: unknown, fallback: number) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : fallback;
  if (spec[0] === 'COMFY_DYNAMICCOMBO_V3') {
    if (!Array.isArray(options.options) || options.options.length === 0 || options.options.length > 256) return undefined;
    const choices = options.options.map((item) => {
      const option = groupSpecs(item);
      if (typeof option.key !== 'string') throw new ObjectInfoError('Invalid DynamicCombo key.');
      return { key: option.key, layout: layout(option.inputs) };
    });
    if (new Set(choices.map((item) => item.key)).size !== choices.length) throw new ObjectInfoError('Duplicate DynamicCombo key.');
    return { ...base, type: 'COMBO', widget: true, options: choices.map((item) => item.key), default: choices[0].key,
      dynamic: { kind: 'combo', options: choices } };
  }
  if (spec[0] === 'COMFY_AUTOGROW_V3') {
    const template = groupSpecs(options.template);
    const child = layout(template.input);
    // The backend accepts one socket per group. Multi-widget frontend-only templates have a different slot layout.
    if (child.inputs.length !== 1 || child.inputs[0].dynamic || child.inputs[0].widget) return undefined;
    const names = Array.isArray(template.names) && template.names.every((item) => typeof item === 'string') ? template.names as string[] : undefined;
    const max = names ? Math.min(100, names.length) : count(template.max, 100);
    const min = Math.min(max, count(template.min, 1));
    return { ...base, type: spec[0], widget: false, dynamic: { kind: 'autogrow', layout: child, min, max,
      prefix: typeof template.prefix === 'string' ? template.prefix : '', ...(names ? { names: names.slice(0, max) } : {}) } };
  }
  if (spec[0] === 'COMFY_DYNAMICGROUP_V3') {
    const max = count(options.max, 100);
    const min = Math.min(max, count(options.min, 0));
    return { ...base, type: 'INT', widget: true, default: min, min, max, step: 1,
      dynamic: { kind: 'group', min, max, layout: layout(options.template) } };
  }
  if (spec[0] === 'COMFY_MATCHTYPE_V3') {
    const template = groupSpecs(options.template);
    if (typeof template.template_id !== 'string' || typeof template.allowed_types !== 'string' || !template.allowed_types) return undefined;
    return { ...base, type: template.allowed_types, widget: false, matchType: template.template_id };
  }
  return undefined;
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

/** One input spec, read: its link type, whether it is a widget, and the extra slots it adds. */
interface ParsedSpec {
  type: string;
  widget: boolean;
  opaque: boolean;
  controlAfterGenerate: boolean;
  controlFilterList: boolean;
  mediaUpload: boolean;
  default?: unknown;
  options?: string[];
  controlDefault?: string;
  /** Field metadata a control needs (range, step, multi-line, tooltip); see fieldMeta. */
  meta: Partial<Pick<CatalogInput, 'auxiliaryNames' | 'displayName' | 'widgetType' | 'min' | 'max' | 'step' | 'multiline' | 'multiSelect' | 'tooltip' | 'mediaType' | 'mediaUpload'>>;
}

function parseSpec(name: string, spec: unknown): ParsedSpec {
  if (!Array.isArray(spec) || spec.length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  const options = spec[1] && typeof spec[1] === 'object' && !Array.isArray(spec[1]) ? (spec[1] as Record<string, unknown>) : {};
  const forceInput = options.forceInput === true;
  if (Array.isArray(spec[0])) return describeInput('COMBO', options, forceInput, name, stringList(spec[0]));
  if (typeof spec[0] !== 'string' || spec[0].length === 0) {
    throw new ObjectInfoError('Catalog snapshot is not object_info.');
  }
  return describeInput(spec[0], options, forceInput, name, Array.isArray(options.options) ? stringList(options.options) : []);
}

function stringList(values: unknown[]): string[] {
  return values.filter((item): item is string => typeof item === 'string');
}

/** Link type stays the object_info type. The widget constructor is widgetType ?? that type. */
function describeInput(linkType: string, options: Record<string, unknown>, forceInput: boolean, name: string, comboOptions: string[]): ParsedSpec {
  const constructorType = widgetConstructorType(linkType, options);
  const opaque = !forceInput && isOpaqueWidgetType(constructorType);
  const widget = !forceInput && (WIDGET_TYPES.has(constructorType) || opaque);
  const controlAfterGenerate = widget && !opaque && hasControlAfterGenerate(constructorType, name, options);
  const ordinaryCombo = constructorType === 'COMBO' && options.multi_select !== true;
  const parsed: ParsedSpec = {
    type: linkType,
    widget,
    opaque,
    controlAfterGenerate,
    controlFilterList: controlAfterGenerate && ordinaryCombo,
    mediaUpload: widget && !opaque && constructorType === 'COMBO' && isMediaUpload(options),
    meta: fieldMeta(linkType, constructorType, options, widget && !opaque),
  };
  if (controlAfterGenerate) {
    const names: Record<string, string> = {};
    for (const key of ['control_after_generate', 'control_filter_list']) {
      const value = options[key];
      const name = typeof value === 'string' && (key !== 'control_after_generate' || !CONTROL_MODES.has(value)) ? value : typeof options.control_prefix === 'string' && options.control_prefix ? `${options.control_prefix} ${key}` : key;
      if (name !== key) names[key] = name;
    }
    if (Object.keys(names).length) parsed.meta.auxiliaryNames = names;
  }
  if (!widget || opaque) return parsed;
  const value = widgetDefault(constructorType, options, comboOptions);
  if (value !== undefined) parsed.default = value;
  if (constructorType === 'COMBO') parsed.options = comboOptions;
  if (controlAfterGenerate) parsed.controlDefault = controlDefault(constructorType, options);
  return parsed;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * What a control needs beyond the value, from the INPUT_TYPES options ComfyUI documents for widgets: `min`, `max`
 * and `step` on INT/FLOAT (the step as the node author wrote it: cfg 0.1, denoise 0.01), `multiline` on STRING,
 * `multi_select` on COMBO, and `tooltip` on any input. A tooltip is kept on sockets as well, for the Ports table.
 * Values of the wrong type are dropped: the control then falls back to an open range.
 */
function fieldMeta(linkType: string, constructorType: string, options: Record<string, unknown>, widget: boolean): ParsedSpec['meta'] {
  const meta: ParsedSpec['meta'] = {};
  if (typeof options.display_name === 'string' && options.display_name) meta.displayName = options.display_name;
  if (typeof options.tooltip === 'string' && options.tooltip.trim() !== '') meta.tooltip = options.tooltip.trim();
  if (!widget) return meta;
  if (options.video_upload === true) meta.mediaType = 'video';
  else if (options.image_upload === true || options.animated_image_upload === true) meta.mediaType = 'image';
  else if (options.audio_upload === true) { meta.mediaType = 'audio'; meta.mediaUpload = true; }
  else if (options.file_upload === true) { meta.mediaType = 'file'; meta.mediaUpload = true; }
  if (constructorType !== linkType) meta.widgetType = constructorType;
  if (constructorType === 'INT' || constructorType === 'FLOAT') {
    const min = finiteNumber(options.min);
    const max = finiteNumber(options.max);
    const step = finiteNumber(options.step);
    if (min !== undefined) meta.min = min;
    if (max !== undefined) meta.max = max;
    if (step !== undefined && step > 0) meta.step = step;
  }
  if (constructorType === 'STRING' && options.multiline === true) meta.multiline = true;
  if (constructorType === 'COMBO' && options.multi_select === true) meta.multiSelect = true;
  return meta;
}

/**
 * The value a new widget starts with in ComfyUI_frontend @98700cfc (src/renderer/extensions/vueNodes/widgets/composables):
 * - useIntWidget / useFloatWidget: `inputSpec.default ?? 0`
 * - useBooleanWidget: `inputSpec.default ?? false`
 * - useStringWidget: `inputSpec.default ?? ''`
 * - useComboWidget getDefaultValue: a truthy `default`, else the first option, else nothing (the frontend shows an
 *   empty combo; here the slot stays unknown and export reports it). A multi_select combo starts with no choice.
 * Opaque widget types have no default here because their slot layout is not reproduced.
 */
function widgetDefault(type: string, options: Record<string, unknown>, comboOptions: string[]): unknown {
  const given = options.default;
  if (type === 'INT' || type === 'FLOAT') return given ?? 0;
  if (type === 'BOOLEAN') return given ?? false;
  if (type === 'STRING') return given ?? '';
  if (type === 'COMBO') {
    if (options.multi_select === true) return given ?? [];
    if (given) return given;
    return comboOptions.length > 0 ? comboOptions[0] : undefined;
  }
  return undefined;
}

/**
 * Start value of the control_after_generate widget, ComfyUI_frontend @98700cfc:
 * - a string `control_after_generate` (fixed|increment|decrement|randomize) is the start value on every constructor;
 * - otherwise INT (useIntWidget, also the implicit seed/noise_seed control) and an ordinary COMBO (addComboWidget)
 *   pass 'randomize';
 * - FLOAT (useFloatWidget) always passes 'fixed', and a multi_select COMBO falls back to 'fixed'.
 * addValueControlWidgets itself turns an empty value into 'randomize'.
 */
function controlDefault(type: string, options: Record<string, unknown>): string {
  const value = options.control_after_generate;
  if (type === 'FLOAT') return 'fixed';
  if (typeof value === 'string' && CONTROL_MODES.has(value)) return value;
  if (type === 'COMBO' && options.multi_select === true) return 'fixed';
  return 'randomize';
}

/** Start value of a widgets_values slot that is not an input: the control combo, the filter text, the upload button. */
export function slotDefault(node: CatalogNode, slot: string): { known: boolean; value?: unknown } {
  const [name, suffix] = slot.split('::');
  const input = node.inputs.find((item) => item.name === name);
  if (!input || !input.widget) return { known: false };
  if (suffix === undefined) return input.default === undefined ? { known: false } : { known: true, value: input.default };
  // addValueControlWidgets: the filter list string widget starts as ''.
  if (suffix === 'control_filter_list') return { known: true, value: '' };
  // useImageUploadWidget: the upload button widget serializes as 'image'.
  if (suffix === 'media_upload') return { known: true, value: 'image' };
  if (suffix === 'control_after_generate') return { known: true, value: input.controlDefault ?? 'randomize' };
  return { known: false };
}

/** Default widget values a new node of this class starts with, keyed by input name (not the extra slots). */
export function defaultParameters(node: CatalogNode | undefined): Record<string, unknown> {
  if (!node || node.widgetOrderReliable === false) return {};
  const out: Record<string, unknown> = {};
  for (const input of node.inputs) {
    if (!input.widget || input.default === undefined || !node.widgetOrder.includes(input.name)) continue;
    out[input.name] = input.default;
  }
  return out;
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

/** The file names a loader's combo lists, for the catalog's model list. */
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
