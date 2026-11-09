import type { CatalogNode, CatalogView } from '../catalog/types';

export interface PortDefinition {
  id: string;
  name: string;
  dataType: string;
  optional: boolean;
}

const INPUTS: Record<string, PortDefinition[]> = {
  KSampler: [
    { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
    { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
    { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
    { id: 'in-3', name: 'latent_image', dataType: 'LATENT', optional: false },
  ],
  VAEDecode: [
    { id: 'in-0', name: 'samples', dataType: 'LATENT', optional: false },
    { id: 'in-1', name: 'vae', dataType: 'VAE', optional: false },
  ],
  SaveImage: [{ id: 'in-0', name: 'images', dataType: 'IMAGE', optional: false }],
  CLIPTextEncode: [
    { id: 'in-0', name: 'clip', dataType: 'CLIP', optional: false },
    { id: 'in-1', name: 'text', dataType: 'STRING', optional: false },
  ],
};

const OUTPUTS: Record<string, PortDefinition[]> = {
  LoadImage: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
  KSampler: [{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }],
  EmptyLatentImage: [{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }],
  VAEDecode: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
  CLIPTextEncode: [{ id: 'out-0', name: 'CONDITIONING', dataType: 'CONDITIONING', optional: false }],
  CheckpointLoaderSimple: [
    { id: 'out-0', name: 'MODEL', dataType: 'MODEL', optional: false },
    { id: 'out-1', name: 'CLIP', dataType: 'CLIP', optional: false },
    { id: 'out-2', name: 'VAE', dataType: 'VAE', optional: false },
  ],
};

/** True when the app ships the ports of this class itself (the core seed classes), synced or not. */
export function hasBuiltinPorts(nodeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(INPUTS, nodeType) || Object.prototype.hasOwnProperty.call(OUTPUTS, nodeType);
}

export function inferInputs(nodeType: string): PortDefinition[] {
  return INPUTS[nodeType] || [];
}

export function inferOutputs(nodeType: string): PortDefinition[] {
  return OUTPUTS[nodeType] || [{ id: 'out-0', name: 'OUTPUT', dataType: 'unknown', optional: false }];
}

/**
 * Imported object_info supplies the sockets. A seed row is pack "core" with empty
 * sockets and is not a port definition. An imported class with no sockets stays empty.
 *
 * Input slot numbers follow ComfyUI_frontend src/services/litegraphService.ts @98700cfc:
 * addInputs adds every socket first (addInputSocket skips widget types unless forceInput),
 * then widget inputs (addInputWidget). Order inside each group is the parser order
 * (input_order required, then optional, then remaining keys). in-N is that combined index.
 * Outputs stay in output-array order.
 */
export function portsForClassType(nodeType: string, catalog: CatalogView): { inputs: PortDefinition[]; outputs: PortDefinition[] } {
  const found = catalog.nodes.find((node) => node.classType === nodeType);
  if (found && !isSeedPlaceholder(found)) return portsFromCatalog(found);
  return { inputs: inferInputs(nodeType), outputs: inferOutputs(nodeType) };
}

function isSeedPlaceholder(node: CatalogNode): boolean {
  return node.pack === 'core' && node.inputs.length === 0 && node.outputs.length === 0;
}

function portsFromCatalog(node: CatalogNode): { inputs: PortDefinition[]; outputs: PortDefinition[] } {
  const sockets = node.inputs.filter((input) => input.widget === false);
  const widgets = node.inputs.filter((input) => input.widget === true);
  return {
    inputs: [...sockets, ...widgets].map((input, index) => ({
      id: `in-${index}`,
      name: input.name,
      dataType: input.type,
      optional: false,
    })),
    outputs: node.outputs.map((output, index) => ({
      id: `out-${index}`,
      name: output.name,
      dataType: output.type,
      optional: false,
    })),
  };
}
