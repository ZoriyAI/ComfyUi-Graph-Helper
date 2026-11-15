/**
 * The readable name of a node with no title of its own (graph/lib/nodeName with the class title store): the
 * library's display name is used on the canvas, in Properties, in check messages and in the tour.
 * Why: "Load Checkpoint" means something to a learner; "CheckpointLoaderSimple" does not, and every place must
 * call the same node by the same name.
 */
import { describe, expect, it } from 'vitest';
import { nodeDisplayName } from '../../src/renderer/components/graph/lib/nodeName';
import { useClassTitleStore } from '../../src/renderer/components/graph/lib/classTitles';
import { nameFindingValues, nodeNamer } from '../../src/renderer/components/check/checkModel';
import { buildTour } from '../../src/renderer/components/graph/tour/buildTour';

describe('a node without its own title is named as the library names it', () => {
  useClassTitleStore.getState().set({ CheckpointLoaderSimple: 'Load Checkpoint', KSampler: 'KSampler' });

  it('on the canvas and in Properties', () => {
    expect(nodeDisplayName({ title: 'CheckpointLoaderSimple', comfyType: 'CheckpointLoaderSimple' })).toBe('Load Checkpoint');
    expect(nodeDisplayName({ comfyType: 'CheckpointLoaderSimple' })).toBe('Load Checkpoint');
    expect(nodeDisplayName({ title: 'My model', comfyType: 'CheckpointLoaderSimple' })).toBe('My model');
    // A class the catalog has no readable name for keeps its class name.
    expect(nodeDisplayName({ comfyType: 'FancyMadeUpNode' })).toBe('FancyMadeUpNode');
    // The caller's catalog detail wins over the cached list.
    expect(nodeDisplayName({ comfyType: 'CheckpointLoaderSimple' }, 'Load Checkpoint (detail)')).toBe('Load Checkpoint (detail)');
  });

  it('in check messages and the export guard', () => {
    const named = nameFindingValues({ nodeId: '1', classType: 'CheckpointLoaderSimple' }, nodeNamer([{ id: '1', data: { title: 'CheckpointLoaderSimple', comfyType: 'CheckpointLoaderSimple' } }]));
    expect(named.node).toBe('Load Checkpoint');
  });

  it('in the tour', () => {
    const steps = buildTour(
      [{ id: '1', data: { comfyType: 'CheckpointLoaderSimple', title: 'CheckpointLoaderSimple' } }] as never,
      [],
      { byNode: {}, byClass: {}, catalog: { CheckpointLoaderSimple: { displayName: 'Load Checkpoint' } } } as never,
      () => '',
    );
    expect(steps[0].title).toBe('Load Checkpoint');
  });
});
