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
  VAEDecode: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
  CLIPTextEncode: [{ id: 'out-0', name: 'CONDITIONING', dataType: 'CONDITIONING', optional: false }],
  CheckpointLoaderSimple: [
    { id: 'out-0', name: 'MODEL', dataType: 'MODEL', optional: false },
    { id: 'out-1', name: 'CLIP', dataType: 'CLIP', optional: false },
    { id: 'out-2', name: 'VAE', dataType: 'VAE', optional: false },
  ],
};

export function inferInputs(nodeType: string): PortDefinition[] {
  return INPUTS[nodeType] || [];
}

export function inferOutputs(nodeType: string): PortDefinition[] {
  return OUTPUTS[nodeType] || [{ id: 'out-0', name: 'OUTPUT', dataType: 'unknown', optional: false }];
}
