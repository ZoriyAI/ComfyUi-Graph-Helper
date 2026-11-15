/**
 * The public screenshots, in the order the gallery shows them. The capture script (public.test.ts) makes exactly
 * these, the gallery pages (docs/screenshots/README*.md) list exactly these, and a unit test keeps the three in step.
 */
export const PUBLIC_SHOTS: readonly string[] = [
  '01-first-start',
  '02-canvas-explained',
  '03-library',
  '04-assistant-ask',
  '05-assistant-build',
  '06-lessons',
  '07-lesson-step',
  '08-check',
  '09-subgraph',
  '10-large-workflow',
  '11-settings-connection',
  '12-settings-assistant',
  '13-help',
  '14-lesson-path',
  '15-lesson-checklist',
  '16-lesson-outcomes',
];

/** The six pictures the root README shows as a table of two columns, the rest live in the gallery. */
export const README_SHOTS: readonly string[] = ['02-canvas-explained', '07-lesson-step', '05-assistant-build', '08-check', '15-lesson-checklist', '16-lesson-outcomes'];
