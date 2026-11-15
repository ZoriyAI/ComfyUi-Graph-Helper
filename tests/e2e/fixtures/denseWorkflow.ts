/**
 * Workflows for canvas tests: a dense twelve-node graph of three partial text-to-picture chains, and a generated
 * hundred-node graph. Used by e2e specs that look at the canvas (canvas-explain, canvas-descriptions, keyboard-route,
 * locale, project-explanations, desktop-captures) and by unit tests of subgraphs, validation and selection editing.
 * The dense graph is crowded and half wired on purpose, so the check and the layout have something to find.
 */

// Node builders in the saved native shape; every socket starts unlinked and the link list below fills them in.
const checkpoint = (id: number, x: number, y: number, title: string) => ({
  id,
  type: 'CheckpointLoaderSimple',
  pos: [x, y],
  size: [210, 120],
  flags: {},
  order: id,
  mode: 0,
  properties: {},
  title,
  inputs: [],
  outputs: [
    { name: 'MODEL', type: 'MODEL', links: [] as number[] },
    { name: 'CLIP', type: 'CLIP', links: [] as number[] },
    { name: 'VAE', type: 'VAE', links: [] as number[] },
  ],
});

const prompt = (id: number, x: number, y: number, title: string) => ({
  id,
  type: 'CLIPTextEncode',
  pos: [x, y],
  size: [210, 100],
  flags: {},
  order: id,
  mode: 0,
  properties: {},
  title,
  inputs: [
    { name: 'clip', type: 'CLIP', link: null as number | null },
    { name: 'text', type: 'STRING', link: null as number | null },
  ],
  outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] as number[] }],
});

const sampler = (id: number, x: number, y: number, title: string) => ({
  id,
  type: 'KSampler',
  pos: [x, y],
  size: [210, 140],
  flags: {},
  order: id,
  mode: 0,
  properties: {},
  title,
  inputs: [
    { name: 'model', type: 'MODEL', link: null as number | null },
    { name: 'positive', type: 'CONDITIONING', link: null as number | null },
    { name: 'negative', type: 'CONDITIONING', link: null as number | null },
    { name: 'latent_image', type: 'LATENT', link: null as number | null },
  ],
  outputs: [{ name: 'LATENT', type: 'LATENT', links: [] as number[] }],
});

const decode = (id: number, x: number, y: number, title: string) => ({
  id,
  type: 'VAEDecode',
  pos: [x, y],
  size: [210, 100],
  flags: {},
  order: id,
  mode: 0,
  properties: {},
  title,
  inputs: [
    { name: 'samples', type: 'LATENT', link: null as number | null },
    { name: 'vae', type: 'VAE', link: null as number | null },
  ],
  outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] as number[] }],
});

/** Twelve nodes in three rows (A wired in part, B and C not at all), with six links in row A. */
export const denseWorkflow = {
  version: 1,
  state: { lastNodeId: 12, lastLinkId: 6 },
  nodes: [
    checkpoint(1, 40, 40, 'Checkpoint A'),
    prompt(2, 280, 20, 'Positive'),
    prompt(3, 280, 180, 'Negative'),
    sampler(4, 520, 60, 'Sample'),
    decode(5, 760, 80, 'Decode'),
    checkpoint(6, 40, 320, 'Checkpoint B'),
    prompt(7, 280, 340, 'Prompt B'),
    sampler(8, 520, 360, 'Sample B'),
    decode(9, 760, 380, 'Decode B'),
    checkpoint(10, 40, 600, 'Checkpoint C'),
    prompt(11, 280, 620, 'Prompt C'),
    decode(12, 760, 640, 'Decode C'),
  ],
  links: [
    { id: 1, origin_id: 1, origin_slot: 1, target_id: 2, target_slot: 0, type: 'CLIP' },
    { id: 2, origin_id: 1, origin_slot: 1, target_id: 3, target_slot: 0, type: 'CLIP' },
    { id: 3, origin_id: 1, origin_slot: 0, target_id: 4, target_slot: 0, type: 'MODEL' },
    { id: 4, origin_id: 2, origin_slot: 0, target_id: 4, target_slot: 1, type: 'CONDITIONING' },
    { id: 5, origin_id: 4, origin_slot: 0, target_id: 5, target_slot: 0, type: 'LATENT' },
    { id: 6, origin_id: 1, origin_slot: 2, target_id: 5, target_slot: 1, type: 'VAE' },
  ],
};

const TYPE_CYCLE = ['MODEL', 'CLIP', 'VAE', 'CONDITIONING', 'LATENT', 'IMAGE'] as const;

/**
 * A hundred nodes on a ten by ten grid, each with one socket of a data type taken in turn from TYPE_CYCLE.
 * Nodes of the same type are linked to each other until that type has 25 links (150 in all), so the canvas has
 * a large but still type-correct graph to draw. Used by desktop-captures for the large-graph picture.
 */
export function hundredNodeWorkflow() {
  const nodes = Array.from({ length: 100 }, (_, index) => {
    const id = index + 1;
    const dataType = TYPE_CYCLE[index % TYPE_CYCLE.length];
    return {
      id,
      type: 'CheckpointLoaderSimple',
      pos: [(index % 10) * 280, Math.floor(index / 10) * 180],
      size: [200, 80],
      flags: {},
      order: index,
      mode: 0,
      properties: {},
      title: `Node ${id}`,
      inputs: [{ name: dataType, type: dataType, link: null as number | null }],
      outputs: [{ name: dataType, type: dataType, links: [] as number[] }],
    };
  });
  const groups = TYPE_CYCLE.map(() => [] as number[]);
  nodes.forEach((node, index) => groups[index % TYPE_CYCLE.length].push(node.id));
  const links: Array<{ id: number; origin_id: number; origin_slot: number; target_id: number; target_slot: number; type: string }> = [];
  let linkId = 1;
  TYPE_CYCLE.forEach((dataType, groupIndex) => {
    const ids = groups[groupIndex];
    for (let offset = 1; links.filter((link) => link.type === dataType).length < 25 && offset < ids.length; offset += 1) {
      for (let index = 0; index + offset < ids.length && links.filter((link) => link.type === dataType).length < 25; index += 1) {
        links.push({
          id: linkId,
          origin_id: ids[index],
          origin_slot: 0,
          target_id: ids[index + offset],
          target_slot: 0,
          type: dataType,
        });
        linkId += 1;
      }
    }
  });
  return {
    version: 1,
    state: { lastNodeId: 100, lastLinkId: links.length },
    nodes,
    links,
  };
}
