/**
 * Guidance read from the local catalog.
 * Field meanings follow ComfyUI object_info (server.py node_info / OpenAPI NodeInfo):
 * python_module, input, input_order, output, output_name.
 * widgetOrder is the widgets_values slot list derived from those inputs.
 */
export interface CatalogInput {
  name: string;
  type: string;
  widget: boolean;
}

export interface CatalogOutput {
  name: string;
  type: string;
}

export interface CatalogNode {
  classType: string;
  pack: string;
  pythonModule: string;
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

export interface CatalogView {
  nodeTypes: string[];
  models: Array<{ directory: string; name: string }>;
  nodes: CatalogNode[];
}
