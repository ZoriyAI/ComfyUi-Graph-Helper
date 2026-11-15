/**
 * Checks that "What flows here?" on a link inside an open subgraph names that subgraph's link, not a link of the
 * main canvas with the same id: both the explanations it looks up and the question it sends carry the scope, the
 * same way the neighbouring "Why" row does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObjectRef } from '../../src/shared/contracts/objects';
import { askWhatFlows } from '../../src/renderer/components/graph/askAbout';
import { requestAsk } from '../../src/renderer/services/ask';
import { useKnowledgeStore } from '../../src/renderer/state/knowledgeState';
import { useUiStore } from '../../src/renderer/state/uiState';

vi.mock('../../src/renderer/services/ask', () => ({ requestAsk: vi.fn() }));

const asked: ObjectRef[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  asked.length = 0;
  useKnowledgeStore.setState({ loadExplanations: vi.fn(async (owner: ObjectRef) => { asked.push(owner); return []; }) } as never);
});

describe('what flows here, inside a subgraph', () => {
  it('looks up and asks about the scoped link', async () => {
    await askWhatFlows('e1', '*', 'What flows here?', 'sub-A');
    expect(asked[0]).toEqual({ kind: 'edge', id: 'e1', subgraphId: 'sub-A' });
    expect(vi.mocked(requestAsk).mock.calls[0][0].context.objectRef).toEqual({ kind: 'edge', id: 'e1', subgraphId: 'sub-A' });
    expect(useUiStore.getState().focusRef).toEqual({ kind: 'edge', id: 'e1', subgraphId: 'sub-A' });
  });

  it('stays unscoped on the main canvas', async () => {
    await askWhatFlows('e1', '*', 'What flows here?', null);
    expect(asked[0]).toEqual({ kind: 'edge', id: 'e1' });
  });
});
