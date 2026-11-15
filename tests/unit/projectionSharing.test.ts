/**
 * How the renderer applies a new graph projection (keepUnchangedNodes in src/renderer/services/commands/projection):
 * an unchanged node keeps the object already on screen, a changed or refused-move node gets a new one, and the
 * selection survives.
 * Why: reusing objects keeps a large canvas from redrawing every node on each change, while a refused drag must
 * snap back to where the engine has the node.
 */
import { describe, expect, it } from 'vitest';
import { keepUnchangedNodes } from '../../src/renderer/services/commands/projection';
import type { GraphNode } from '../../src/renderer/types/graph';

/** A Note node at (x, 0) as the engine projects it. */
function node(id: string, x: number, title = 'Note'): GraphNode {
  return { id, type: 'comfy', position: { x, y: 0 }, data: { title, comfyType: 'Note' } } as unknown as GraphNode;
}

describe('a projection keeps the nodes that did not change', () => {
  it('reuses the object on screen for an unchanged node and makes a new one for a changed node', () => {
    const first = keepUnchangedNodes([], [node('1', 0), node('2', 10)]);
    // The canvas measured the nodes and the person selected one (as React Flow does: new objects, same data).
    const shown = first.map((item) => ({ ...item, measured: { width: 200, height: 80 }, selected: item.id === '2' })) as GraphNode[];
    const next = keepUnchangedNodes(shown, [node('1', 0), node('2', 50)]);
    expect(next[0]).toBe(shown[0]);
    expect(next[1]).not.toBe(shown[1]);
    expect(next[1].position.x).toBe(50);
    expect(next[1].selected).toBe(true);
  });

  it('puts a node back where the engine has it when the canvas moved it and the move was refused', () => {
    const first = keepUnchangedNodes([], [node('1', 0)]);
    const dragged = [{ ...first[0], position: { x: 300, y: 0 } }] as GraphNode[];
    const next = keepUnchangedNodes(dragged, [node('1', 0)]);
    expect(next[0].position.x).toBe(0);
    expect(next[0]).not.toBe(dragged[0]);
  });

  it('forgets removed nodes and treats a node with changed content as new', () => {
    const first = keepUnchangedNodes([], [node('1', 0), node('2', 0)]);
    const second = keepUnchangedNodes(first, [node('1', 0, 'Renamed')]);
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe(first[0]);
    expect((second[0].data as { title: string }).title).toBe('Renamed');
  });
});
