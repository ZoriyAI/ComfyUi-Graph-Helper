/**
 * A file or link dropped anywhere outside a drop target would make Chromium navigate the app window to it.
 * The document cancels the default for those drags only: the canvas keeps its own drops (application/x-helper-*),
 * and plain text can still be dropped into fields.
 */
export function isForeignDrag(types: readonly string[]): boolean {
  if (types.some((type) => type.startsWith('application/x-helper-'))) return false;
  return types.includes('Files') || types.includes('text/uri-list');
}
