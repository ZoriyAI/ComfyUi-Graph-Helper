/**
 * A catalog category in the person's language: ComfyUI's own categories ("loaders", "advanced/conditioning",
 * "image/upscaling") are translated part by part through the inspector.categories catalog keys; a pack's own name
 * (WanVideoWrapper) stays as it is. Used by Inspector, the node card (nodes/NodeCard.tsx) and AddNodeSearch.
 */
/** ComfyUI's own category words that have a translation; anything else is a pack's name and stays. */
const KNOWN = new Set([
  'loaders', 'sampling', 'conditioning', 'latent', 'image', 'mask', 'video', 'audio', 'advanced', 'upscaling',
  'model_patches', 'utils', 'postprocessing',
]);

/** The category path with its known parts translated, joined by " / "; '' for no category. */
export function categoryLabel(category: string | undefined | null, t: (key: string) => string): string {
  if (!category) return '';
  return category
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (KNOWN.has(part.toLowerCase()) ? t(`inspector.categories.${part.toLowerCase()}`) : part))
    .join(' / ');
}
