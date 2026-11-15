import { describe, expect, it } from 'vitest';
import { withoutServiceMark } from '../../src/renderer/components/chat/ProposalCard';

describe('a draft note', () => {
  it('drops the engine mark, keeps the words', () => {
    expect(withoutServiceMark('Model into the sampler. [superseded: node 27 was removed by remove-node]')).toBe('Model into the sampler.');
    expect(withoutServiceMark('Plain note.')).toBe('Plain note.');
  });
});
