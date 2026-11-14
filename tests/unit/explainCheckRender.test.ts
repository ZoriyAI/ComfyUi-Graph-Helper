import { describe, expect, it, beforeEach, vi } from 'vitest';

// Zustand serves its initial state to a server render. This copy of `create` serves the live state instead,
// so the panels render the data each test puts in the stores.
vi.mock('zustand', async () => {
  const vanilla = await vi.importActual<typeof import('zustand/vanilla')>('zustand/vanilla');
  const react = await vi.importActual<typeof import('react')>('react');
  const create = <T,>(init: import('zustand/vanilla').StateCreator<T, [], []>) => {
    const api = vanilla.createStore<T>(init);
    const hook = <U,>(selector: (state: T) => U = (state) => state as unknown as U) => react.useSyncExternalStore(
      api.subscribe,
      () => selector(api.getState()),
      () => selector(api.getState()),
    );
    return Object.assign(hook, api);
  };
  return { create };
});
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import ExplainPanel from '../../src/renderer/components/explain/ExplainPanel';
import CheckPanel from '../../src/renderer/components/check/CheckPanel';
import { useKnowledgeStore } from '../../src/renderer/state/knowledgeState';
import { useUiStore } from '../../src/renderer/state/uiState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';
import { useGraphStore } from '../../src/renderer/state/graphState';
import type { Explanation, GraphCheckReport } from '../../src/shared/contracts';
import { en } from '../../src/shared/i18n';

/** Static render of the Explain and Check panels with English strings; effects do not run here. */

const i18n = createInstance();
void i18n.init({ resources: { en: { translation: en } }, lng: 'en', interpolation: { escapeValue: false }, initImmediate: false } as Parameters<typeof i18n.init>[0]);

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, element));
}

const item = (patch: Partial<Explanation>): Explanation => ({
  id: 'e', projectId: 'p', owner: { kind: 'node', id: 'n1' }, aspect: 'what', text: 'Loads weights.', provenance: 'fact',
  sourceUrl: null, revisionId: 'rev-2', createdBy: 'ai', createdAt: 1, ...patch,
});

describe('Explain panel render', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [{ id: 'n1', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'CheckpointLoaderSimple', title: 'Loader', inputs: [], outputs: [], parameters: {} } }], edges: [] });
    useRevisionStore.setState({ currentRevisionId: 'rev-2' });
    useKnowledgeStore.setState({ explanations: {}, recent: [] });
  });

  it('teaches how to ask when nothing is focused', () => {
    useUiStore.setState({ focusRef: null, selection: [] });
    const html = render(React.createElement(ExplainPanel));
    expect(html).toContain('Nothing to explain yet');
    expect(html).toContain('Right-click a node');
    expect(html).toContain('Recent explanations');
  });

  it('groups by aspect with provenance, stale and web source, and offers the missing aspects', () => {
    useUiStore.setState({ focusRef: { kind: 'node', id: 'n1' }, selection: [] });
    useKnowledgeStore.setState({
      explanations: {
        'node:n1': [
          item({ id: 'a' }),
          item({ id: 'b', aspect: 'risk', text: 'Old note.', provenance: 'inference', revisionId: 'rev-1', createdBy: 'seed' }),
          item({ id: 'c', aspect: 'why', text: 'From a page.', provenance: 'web', sourceUrl: 'https://example.com/doc' }),
        ],
        'nodeClass:CheckpointLoaderSimple': [item({ id: 'd', owner: { kind: 'nodeClass', id: 'CheckpointLoaderSimple' }, projectId: null, revisionId: null, text: 'Shared.', provenance: 'fact', createdBy: 'seed' })],
      },
    });
    const html = render(React.createElement(ExplainPanel));
    expect(html).toContain('Loader');
    expect(html).toContain('What it is');
    expect(html).toContain('Watch out');
    expect(html).toContain('data-provenance="inference"');
    expect(html).toContain('>Guess<');
    expect(html).toContain('>Fact<');
    expect(html).toContain('Written for an earlier version of the graph');
    // The assistant's words read as the assistant's, whatever it called them, and can be removed in one action.
    expect(html).toContain('data-by="assistant"');
    expect(html).toContain('>Assistant<');
    expect(html).toContain('Remove what the assistant wrote here');
    expect(html.match(/Written for an earlier version/g)).toHaveLength(1);
    expect(html).toContain('https://example.com/doc');
    expect(html).not.toContain('href=');
    expect(html).toContain('About the node type CheckpointLoaderSimple');
    expect(html).toContain('General knowledge, not tied to this graph');
    expect(html).toContain('Explain: How to connect it');
    expect(html).toContain('Explain: What to do next');
    expect(html).not.toContain('Explain: What it is');
    expect(html).toContain('Save note');
  });
});

describe('Check panel render', () => {
  it('shows the not-run state, the all-clear state, and grouped findings', () => {
    useKnowledgeStore.setState({ check: null, checking: false });
    expect(render(React.createElement(CheckPanel, { projectId: 'p' }))).toContain('The graph has not been checked yet.');

    const clean: GraphCheckReport = { ok: true, missingNodes: [], missingModels: [], typeMismatches: [], baseModelMismatches: [], unconnectedRequiredInputs: [], unknownNodeTypes: [] };
    useKnowledgeStore.setState({ check: clean });
    expect(render(React.createElement(CheckPanel, { projectId: 'p' }))).toContain('No problems found.');

    useKnowledgeStore.setState({
      check: {
        ...clean,
        ok: false,
        baseModelMismatches: [{ nodeId: 'n3', model: 'l.safetensors', modelBase: 'sdxl', otherNodeId: 'n1', otherModel: 'a.safetensors', otherBase: 'flux1' }],
        unconnectedRequiredInputs: [{ nodeId: 'n1', input: 'model', type: 'MODEL' }],
      },
    });
    const html = render(React.createElement(CheckPanel, { projectId: 'p' }));
    expect(html).toContain('2 findings');
    expect(html).toContain('Models from different families (1)');
    expect(html).toContain('l.safetensors is made for SDXL, but a.safetensors upstream is Flux.1.');
    // Findings name the node by its title on the canvas; the id is the row's tooltip.
    // The node's name stands out in bold.
    expect(html).toContain('Input model (MODEL) on <strong>“Loader”</strong> needs a link.');
    expect(html).toContain('title="Node number n1"');
    expect(html).not.toContain('on node n1');
    expect(html).toContain('Ask why');
  });
});
