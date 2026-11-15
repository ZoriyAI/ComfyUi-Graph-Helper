/**
 * The node classes the lessons of "The daily work cycle" (src/shared/lessons/sets/daily-cycle.ts) use that the fake
 * ComfyUI did not have yet, as ComfyUI declares them in nodes.py: Upscale Image By (the cheap preview branch of the
 * partial execution lesson) and Empty Image (the plain picture of the minimal failing example). Both are ComfyUI's
 * own (pack 0 of the fake server). The fake server serves them with its video classes; the lesson tests read them
 * through `dailyCycleSpecs`.
 */
import { lessonSpecs, type FoundationsClassDef } from './foundations';

/** The classes, all in pack 0 (comfy-core). */
export const DAILY_CYCLE_CLASSES: FoundationsClassDef[] = [
  {
    classType: 'ImageScaleBy',
    pack: 0,
    display: 'Upscale Image By',
    category: 'image/upscaling',
    required: { image: ['IMAGE'], upscale_method: [['nearest-exact', 'bilinear', 'area', 'bicubic', 'lanczos']], scale_by: ['FLOAT', { default: 1, min: 0.01, max: 8, step: 0.01 }] },
    output: ['IMAGE'],
  },
];

/** The classes as the lesson tests describe a node: inputs with their start value, and outputs. */
export function dailyCycleSpecs(): ReturnType<typeof lessonSpecs> {
  return lessonSpecs(DAILY_CYCLE_CLASSES);
}
