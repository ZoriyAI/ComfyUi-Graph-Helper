/**
 * Port type colours as CSS custom properties. Shell owns the tokens; each var has a fallback so the canvas
 * still reads correctly before new tokens land. Used across the canvas (NodeCard, PortHandle, FieldRow, TypedEdge,
 * BoundaryNode, GhostLayer, ConnectAssistLayer), Inspector, AddNodeSearch and the node library.
 */
const TYPE_TOKENS: Record<string, string> = {
  MODEL: 'var(--type-model, #b79cff)',
  CLIP: 'var(--type-clip, #f2d36b)',
  VAE: 'var(--type-vae, #ff7a7a)',
  CONDITIONING: 'var(--type-conditioning, #ffa25e)',
  LATENT: 'var(--type-latent, #ff8ad8)',
  IMAGE: 'var(--type-image, #6cc6ff)',
  MASK: 'var(--type-mask, #7fdc8a)',
  CONTROL_NET: 'var(--type-controlnet, #3fd6bf)',
  STRING: 'var(--type-string, #9aa4b2)',
  INT: 'var(--type-int, #9aa4b2)',
  FLOAT: 'var(--type-float, #9aa4b2)',
  BOOLEAN: 'var(--type-boolean, #9aa4b2)',
  CLIP_VISION: 'var(--type-clip-vision, #e6c56b)',
  CLIP_VISION_OUTPUT: 'var(--type-clip-vision, #e6c56b)',
  UPSCALE_MODEL: 'var(--type-upscale-model, #c9a0ff)',
  AUDIO: 'var(--type-audio, #7fc8a9)',
  NOISE: 'var(--type-noise, #9aa4b2)',
  SAMPLER: 'var(--type-sampler, #9aa4b2)',
  SIGMAS: 'var(--type-sigmas, #9aa4b2)',
  GUIDER: 'var(--type-guider, #9aa4b2)',
};

/** Colour of a port whose type is unknown or the wildcard '*'. */
export const UNKNOWN_TYPE_COLOR = 'var(--type-unknown, #8b939c)';

/**
 * Pack types (WanVideoWrapper and others) are named after what they carry: WANVIDEOMODEL, WANVAE, WANTEXTENCODER,
 * WANVIDEOTEXTEMBEDS. Matched by family, in this order, so they draw in the colour a person already knows from the
 * core types instead of a flat grey. The order matters: IMAGE_CLIPEMBEDS is CLIP vision, IMAGE_EMBEDS conditioning.
 */
const TYPE_FAMILIES: Array<[RegExp, string]> = [
  [/CLIP_?VISION|CLIPEMBEDS/, 'CLIP_VISION'],
  [/EMBEDS|CONDITIONING/, 'CONDITIONING'],
  [/VAE/, 'VAE'],
  [/TEXT_?ENCODER|^T5|CLIP/, 'CLIP'],
  [/MODEL$|LORA/, 'MODEL'],
  [/LATENT|SAMPLES/, 'LATENT'],
  [/AUDIO/, 'AUDIO'],
  [/IMAGE|VIDEO|FRAMES/, 'IMAGE'],
  [/MASK/, 'MASK'],
  [/POSE|CONTROL/, 'CONTROL_NET'],
];

/** The colour of a link data type: its own token, else its family's, else the unknown colour. */
export function typeColor(dataType: unknown): string {
  const key = String(dataType ?? '').toUpperCase();
  const exact = TYPE_TOKENS[key];
  if (exact) return exact;
  if (key === '' || key === '*') return UNKNOWN_TYPE_COLOR;
  for (const [pattern, family] of TYPE_FAMILIES) {
    if (pattern.test(key)) return TYPE_TOKENS[family];
  }
  return UNKNOWN_TYPE_COLOR;
}

/** Category → the type its nodes are mostly about, so the header strip matches the ports it produces. */
const CATEGORY_TYPES: Array<[RegExp, string]> = [
  [/^loaders?\b|checkpoint|unet|lora/i, 'MODEL'],
  [/sampling|sampler/i, 'LATENT'],
  [/conditioning|clip|prompt|text/i, 'CONDITIONING'],
  [/latent/i, 'LATENT'],
  [/mask/i, 'MASK'],
  [/controlnet|control/i, 'CONTROL_NET'],
  [/image|upscal|preview|save/i, 'IMAGE'],
  [/vae/i, 'VAE'],
];

/** Header strip colour: from the catalog category when known, else from the node's main port type. */
export function categoryAccent(category: string | undefined, primaryType: string | undefined): string {
  if (category) {
    for (const [pattern, type] of CATEGORY_TYPES) {
      if (pattern.test(category)) return typeColor(type);
    }
  }
  return typeColor(primaryType);
}
