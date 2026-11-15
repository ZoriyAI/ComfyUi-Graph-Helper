import { describe, expect, it } from 'vitest';
import { CLASSES, PACKS, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

/**
 * The fake ComfyUI's classes are put together from many lesson sets. A set that brings a class another set already
 * brought would make the fake list one class twice; this catches it when the sets are merged.
 */
describe('the classes of the fake ComfyUI', () => {
  it('lists every class once, in the default list and the opt-in list together', () => {
    const names = [...CLASSES, ...VIDEO_CLASSES].map((item) => item.classType);
    const twice = names.filter((name, index) => names.indexOf(name) !== index);
    expect(twice).toEqual([]);
  });

  it('lists every pack once', () => {
    const names = PACKS.map((pack) => (typeof pack === 'string' ? pack : (pack as { name?: string; id?: string }).name ?? (pack as { id?: string }).id));
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });
});
