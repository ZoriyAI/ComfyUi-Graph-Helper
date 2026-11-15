/** The node card reads link types and packs through the knowledge layer, so every knowledge set reaches it. */
import { describe, expect, it } from 'vitest';
import { linkTypeNote, packNote } from '../../src/shared/knowledge/coreKnowledge';

describe('knowledge the node card shows', () => {
  it('a core link type and a type only a later set knows both explain themselves', () => {
    expect(linkTypeNote('MODEL', 'en')?.what).toBeTruthy();
    expect(linkTypeNote('latent', 'ru')?.what).toBeTruthy();
  });

  it('a pack name nobody describes has no note, so the card shows no line', () => {
    expect(packNote('no-such-pack-anywhere', 'en')).toBeNull();
  });
});
