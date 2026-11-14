/** Which micro-illustration a node class gets. Pure, so the mapping is tested without React. */
export type IllustrationKind =
  | 'sampler'
  | 'vae-decode'
  | 'vae-encode'
  | 'text-encode'
  | 'lora'
  | 'weights'
  | 'controlnet'
  | 'image'
  | 'empty-latent'
  | 'video'
  | 'audio'
  | 'set-get'
  | 'subgraph'
  | 'generic';

export const ILLUSTRATION_KINDS: readonly IllustrationKind[] = [
  'sampler', 'vae-decode', 'vae-encode', 'text-encode', 'lora', 'weights', 'controlnet', 'image', 'empty-latent',
  'video', 'audio', 'set-get', 'subgraph', 'generic',
];

const EXACT: Record<string, IllustrationKind> = {
  KSampler: 'sampler',
  KSamplerAdvanced: 'sampler',
  SamplerCustom: 'sampler',
  SamplerCustomAdvanced: 'sampler',
  VAEDecode: 'vae-decode',
  VAEDecodeTiled: 'vae-decode',
  VAEEncode: 'vae-encode',
  VAEEncodeTiled: 'vae-encode',
  VAEEncodeForInpaint: 'vae-encode',
  CLIPTextEncode: 'text-encode',
  CLIPTextEncodeSDXL: 'text-encode',
  LoraLoader: 'lora',
  LoraLoaderModelOnly: 'lora',
  CheckpointLoaderSimple: 'weights',
  UNETLoader: 'weights',
  ImageOnlyCheckpointLoader: 'weights',
  ControlNetLoader: 'controlnet',
  ControlNetApply: 'controlnet',
  ControlNetApplyAdvanced: 'controlnet',
  LoadImage: 'image',
  SaveImage: 'image',
  PreviewImage: 'image',
  EmptyLatentImage: 'empty-latent',
  EmptySD3LatentImage: 'empty-latent',
};

export function illustrationKind(classType: string | undefined): IllustrationKind {
  if (!classType) return 'generic';
  const exact = EXACT[classType];
  if (exact) return exact;
  if (/ksampler|sampler/i.test(classType)) return 'sampler';
  if (/controlnet/i.test(classType)) return 'controlnet';
  if (/lora/i.test(classType)) return 'lora';
  if (/textencode/i.test(classType)) return 'text-encode';
  if (/emptylatent/i.test(classType)) return 'empty-latent';
  // Pack nodes by the words of their class names (WanVideo, VHS, KJNodes and the like), so a video or sound graph
  // gets pictures too, not the plain fallback on almost every node.
  if (/^(Set|Get)Node$/.test(classType)) return 'set-get';
  if (/audio|wav2vec|melband|speech|voice|talk/i.test(classType)) return 'audio';
  if (/decode/i.test(classType)) return 'vae-decode';
  if (/encode/i.test(classType) && /(image|vae|latent)/i.test(classType)) return 'vae-encode';
  if (/(text|prompt|t5|clip).*encode|encode.*(text|prompt)/i.test(classType)) return 'text-encode';
  if (/loader|loadmodel|modelload/i.test(classType) && !/load(image|video|audio)/i.test(classType)) return 'weights';
  if (/video|frames|combine|animate/i.test(classType)) return 'video';
  if (/load.*image|image.*load|saveimage|previewimage|imageresize|resize|upscale/i.test(classType)) return 'image';
  return 'generic';
}

/** Deterministic pseudo-random points for noise fields: the static frame never changes between renders. */
export function noisePoints(count: number, width: number, height: number, seed = 7): Array<{ x: number; y: number; r: number }> {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * width * 10) / 10,
    y: Math.round(next() * height * 10) / 10,
    r: 0.6 + Math.round(next() * 10) / 10,
  }));
}
