/**
 * The note on a draft card in the chat (withoutServiceMark in src/renderer/components/chat/ProposalCard): the
 * engine's [superseded: ...] mark is dropped and the assistant's words stay.
 * Why: the mark is for the log; the person reads only why the change was suggested.
 */
import { describe, expect, it } from 'vitest';
import { withoutServiceMark } from '../../src/renderer/components/chat/ProposalCard';

describe('a draft note', () => {
  it('drops the engine mark, keeps the words', () => {
    expect(withoutServiceMark('Model into the sampler. [superseded: node 27 was removed by remove-node]')).toBe('Model into the sampler.');
    expect(withoutServiceMark('Plain note.')).toBe('Plain note.');
  });
});
