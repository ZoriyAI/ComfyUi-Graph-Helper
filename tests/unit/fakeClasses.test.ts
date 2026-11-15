/**
 * Keeps the fake ComfyUI (tests/fixtures/mcp/fakeMcpServer.ts) honest. Its classes are put together from many lesson
 * sets, and the integration and e2e tests run every lesson against it. A set that brings a class another set already
 * brought would make the fake list one class twice, so a lesson could pass here and still behave differently on a
 * real ComfyUI; this catches it when the sets are merged.
 */
import { describe, expect, it } from 'vitest';
import { CLASSES, PACKS, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

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
