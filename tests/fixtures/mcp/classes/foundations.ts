/**
 * The node classes the foundations lessons use that the fake ComfyUI did not have yet, as ComfyUI declares them
 * (comfy_extras/nodes_primitive.py, nodes_logic.py, nodes_textgen.py, nodes_preview_any.py).
 * All are ComfyUI's own (pack 0 of the fake server). The fake server serves them with its video classes, where every
 * lesson's nodes are; the lesson tests read them through `lessonSpecs`. VAE Decode (Tiled) comes from the video
 * set's fixture (classes/video.ts): the fake server must not list a class twice.
 */

type InputSpec = [string, Record<string, unknown>?] | [string[], Record<string, unknown>?];

/** One class in the fake server's own shape: `pack` is an index into its PACKS, inputs as /object_info writes them. */
export interface FoundationsClassDef {
  classType: string;
  pack: number;
  display: string;
  category: string;
  required?: Record<string, InputSpec>;
  optional?: Record<string, InputSpec>;
  output: string[];
  outputName?: string[];
  outputNode?: boolean;
  description?: string;
}

/** The foundations classes, all in pack 0 (comfy-core). */
export const FOUNDATIONS_CLASSES: FoundationsClassDef[] = [
  { classType: 'PrimitiveInt', pack: 0, display: 'Int', category: 'utilities/primitive', required: { value: ['INT', { default: 0, control_after_generate: 'fixed' }] }, output: ['INT'] },
  { classType: 'PrimitiveStringMultiline', pack: 0, display: 'Text (Multiline)', category: 'utilities/primitive', required: { value: ['STRING', { multiline: true }] }, output: ['STRING'] },
  { classType: 'PrimitiveBoolean', pack: 0, display: 'Boolean', category: 'utilities/primitive', required: { value: ['BOOLEAN', { default: false }] }, output: ['BOOLEAN'] },
  {
    classType: 'ComfySwitchNode', pack: 0, display: 'If/Else Switch', category: 'utilities/logic',
    required: { switch: ['BOOLEAN', { default: false }] }, optional: { on_false: ['*', { lazy: true }], on_true: ['*', { lazy: true }] },
    output: ['*'], outputName: ['output'],
  },
  {
    classType: 'TextGenerateV2', pack: 0, display: 'Generate Text', category: 'text',
    required: { clip: ['CLIP'], prompt: ['STRING', { multiline: true, dynamicPrompts: true, default: '' }], max_length: ['INT', { default: 512, min: 1, max: 32768 }] },
    optional: { thinking: ['BOOLEAN', { default: false }], system_prompt: ['STRING', { forceInput: true }] },
    output: ['STRING', 'STRING'], outputName: ['generated_text', 'thinking'],
  },
  { classType: 'PreviewAny', pack: 0, display: 'Preview as Text', category: 'utilities', required: { source: ['*'] }, output: ['STRING'], outputNode: true },
];

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN']);
const START: Record<string, unknown> = { INT: 0, FLOAT: 0, STRING: '', BOOLEAN: false };

/** The classes in the shape tests/unit/lessons.test.ts uses: inputs with the value a fresh node starts with, outputs. */
export function lessonSpecs(classes: readonly FoundationsClassDef[] = FOUNDATIONS_CLASSES): Record<string, { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> }> {
  const out: Record<string, { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> }> = {};
  for (const def of classes) {
    const inputs: Array<[string, string, unknown?]> = [];
    for (const [name, [type, options]] of Object.entries({ ...def.required, ...def.optional })) {
      if (Array.isArray(type)) inputs.push([name, 'COMBO', options?.default ?? type[0]]);
      else if (typeof type === 'string' && WIDGET_TYPES.has(type) && !options?.forceInput) inputs.push([name, type, options?.default ?? START[type]]);
      else inputs.push([name, String(type)]);
    }
    const names = def.outputName ?? def.output;
    out[def.classType] = { inputs, outputs: def.output.map((type, index) => [names[index] ?? type, type]) };
  }
  return out;
}
