/**
 * Guidance read from the local catalog.
 * Field meanings follow ComfyUI object_info (server.py node_info / OpenAPI NodeInfo):
 * python_module, input, input_order, output, output_name.
 * widgetOrder is the widgets_values slot list derived from those inputs.
 * objectInfo.ts makes these records, main stores them, and the whole app reads them as a CatalogView.
 */
export interface CatalogInput {
  name: string;
  displayName?: string;
  /** Actual names of auxiliary frontend widgets (positional keys remain unambiguous). */
  auxiliaryNames?: Record<string, string>;
  type: string;
  widget: boolean;
  /** From the object_info group: true under input.required, false under input.optional. */
  required?: boolean;
  /**
   * The value a fresh ComfyUI_frontend widget starts with (see objectInfo.ts widgetDefault). Only on widget inputs;
   * absent when no default is known (opaque widgets, a combo with no options).
   */
  default?: unknown;
  /** Combo choices, in object_info order. Only on combo widgets. */
  options?: string[];
  /** Start value of the `<name>::control_after_generate` slot, when the widget has one. */
  controlDefault?: string;
  /**
   * The frontend widget constructor when object_info names one other than `type` (`widgetType`), e.g. a STRING
   * socket drawn as a COMBO. Absent when it is `type` itself.
   */
  widgetType?: string;
  /** Number range and step from the INT/FLOAT options; only on number widgets, only when object_info gives them. */
  min?: number;
  max?: number;
  step?: number;
  /** A STRING widget drawn as a multi-line text box (prompts). */
  multiline?: boolean;
  /** A combo that takes several choices at once (`multi_select`). */
  multiSelect?: boolean;
  /** A file-upload combo: a newly uploaded file need not be in the last catalog listing. */
  mediaUpload?: boolean;
  /** The file picker filter; independent of the serialized upload-button slot. */
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  /** object_info `tooltip`: the node author's one-line help for this input. Kept on sockets too. */
  tooltip?: string;
  /** ComfyUI INPUT_IS_LIST: the execution receives the whole list, not one mapped item. */
  isList?: boolean;
  /** Native V3 declarations. Expanded separately for each node's saved values. */
  dynamic?: DynamicInput;
  matchType?: string;
}

export interface CatalogLayout {
  inputs: CatalogInput[];
  widgetOrder: string[];
  widgetOrderReliable?: boolean;
}

export type DynamicInput =
  | { kind: 'combo'; options: Array<{ key: string; layout: CatalogLayout }> }
  | { kind: 'autogrow'; min: number; max: number; prefix: string; names?: string[]; layout: CatalogLayout }
  | { kind: 'group'; min: number; max: number; layout: CatalogLayout };

/** One output socket: its name and the type a link from it carries. */
export interface CatalogOutput {
  name: string;
  type: string;
  isList?: boolean;
  matchType?: string;
}

/** One node class. `pack` is the Python module it came from ('nodes' for ComfyUI's core). */
export interface CatalogNode {
  classType: string;
  pack: string;
  pythonModule: string;
  /** Frontend display name and category as the server reports them. Empty when unknown. */
  displayName?: string;
  category?: string;
  /** object_info description and output_node. */
  description?: string;
  outputNode?: boolean;
  /** object_info api_node (a paid node that runs on an outside service), deprecated and experimental. */
  apiNode?: boolean;
  deprecated?: boolean;
  experimental?: boolean;
  inputs: CatalogInput[];
  outputs: CatalogOutput[];
  /** widgets_values slot names. Empty when widgetOrderReliable is false. */
  widgetOrder: string[];
  /**
   * False when a frontend widget type has no stable widgets_values layout here.
   * widgetIndexFor must then return undefined.
   */
  widgetOrderReliable?: boolean;
}

/** One model file the server lists, by its models folder and its name inside it. */
export interface CatalogModel {
  directory: string;
  name: string;
  /** File size when the MCP server reported one. */
  sizeBytes?: number | null;
}

/** The installed catalog as everything else reads it: class names, model files and node definitions. */
export interface CatalogView {
  nodeTypes: string[];
  models: CatalogModel[];
  nodes: CatalogNode[];
}
