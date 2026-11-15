/**
 * A tiny native workflow of three typed nodes (checkpoint, prompt, decoder) with one CLIP link and open MODEL,
 * LATENT and VAE sockets. Used by editor-selection and workspace-motion e2e specs and by several unit tests
 * (subgraphs, groupRename, graphTools, proposals, subgraphCodec) that need real socket types to connect or check.
 */
export const typedWorkflow = {
  version: 1,
  state: { lastNodeId: 3, lastLinkId: 2 },
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      pos: [40, 80],
      size: [240, 140],
      flags: {},
      order: 0,
      mode: 0,
      properties: {},
      title: 'Checkpoint',
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [] },
        { name: 'CLIP', type: 'CLIP', links: [2] },
        { name: 'VAE', type: 'VAE', links: [] },
      ],
    },
    {
      id: 2,
      type: 'CLIPTextEncode',
      pos: [360, 40],
      size: [240, 120],
      flags: {},
      order: 1,
      mode: 0,
      properties: {},
      title: 'Positive',
      inputs: [{ name: 'clip', type: 'CLIP', link: 2 }],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
    },
    {
      id: 3,
      type: 'VAEDecode',
      pos: [360, 220],
      size: [240, 120],
      flags: {},
      order: 2,
      mode: 0,
      properties: {},
      title: 'Decode',
      inputs: [
        { name: 'samples', type: 'LATENT', link: null },
        { name: 'vae', type: 'VAE', link: null },
      ],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
    },
  ],
  links: [
    { id: 2, origin_id: 1, origin_slot: 1, target_id: 2, target_slot: 0, type: 'CLIP' },
  ],
};
