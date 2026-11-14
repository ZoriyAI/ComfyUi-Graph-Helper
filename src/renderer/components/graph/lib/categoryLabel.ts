/**
 * A catalog category in the person's language: ComfyUI's own categories ("loaders", "advanced/conditioning",
 * "image/upscaling") are words a person can read in Russian; a pack's own name (WanVideoWrapper) stays as it is.
 */
const KNOWN = new Set([
  'loaders', 'sampling', 'conditioning', 'latent', 'image', 'mask', 'video', 'audio', 'advanced', 'upscaling',
  'model_patches', 'utils', 'postprocessing',
]);

export function categoryLabel(category: string | undefined | null, t: (key: string) => string): string {
  if (!category) return '';
  return category
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (KNOWN.has(part.toLowerCase()) ? t(`inspector.categories.${part.toLowerCase()}`) : part))
    .join(' / ');
}
