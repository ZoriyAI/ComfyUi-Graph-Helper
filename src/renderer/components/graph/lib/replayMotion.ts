/**
 * The history view ("Replay history") shows what each version changed (motion package). CanvasFlow mounts
 * useReplayMotion while a version is on screen.
 */
import { useEffect, useRef } from 'react';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import { useCanvasStore } from '../canvasStore';
import { canvasHandle } from '../../../commands/canvasHandle';
import { changedNodes, diffGraph } from './graphDiff';
import { flash } from '../../../motion/attention';
import { motionMs } from '../../../motion/policy';

/**
 * Between the version shown before and the one shown now:
 * - nodes and links that appear draw themselves in (the reveal every new node and link has);
 * - nodes that leave fade where they stood;
 * - nodes whose fields or names changed flash;
 * - nodes that moved glide (CanvasFlow's glide runs on this level too);
 * - when none of that is in view, the camera brings the first change into view, by the camera rule.
 * Why: the history swapped whole pictures; a person could not see what a version did.
 * With motion reduced or off the changes still carry their marks, without movement.
 */

/** Ids of nodes and links that appeared, nodes that left (whole, to draw them fading) and nodes that changed. */
export interface ReplayChange {
  added: string[];
  addedEdges: string[];
  removed: GraphNode[];
  changed: string[];
}

/** What changed from one version to the next. Pure. */
export function replayChange(before: { nodes: GraphNode[]; edges: GraphEdge[] }, after: { nodes: GraphNode[]; edges: GraphEdge[] }): ReplayChange {
  const diff = diffGraph(before, after);
  const remaining = new Set(after.nodes.map((node) => node.id));
  return {
    added: diff.addedNodes,
    addedEdges: diff.addedEdges,
    removed: before.nodes.filter((node) => !remaining.has(node.id)),
    changed: changedNodes(before.nodes, after.nodes),
  };
}

/** A node's box; an unmeasured node gets a typical card size. */
function boxOf(node: GraphNode): { x: number; y: number; width: number; height: number } {
  return { x: node.position.x, y: node.position.y, width: node.measured?.width ?? node.width ?? 240, height: node.measured?.height ?? node.height ?? 120 };
}

/** Plays the change between the previous and the current version whenever `view` changes; null outside replay. */
export function useReplayMotion(view: { nodes: GraphNode[]; edges: GraphEdge[] } | null): void {
  const previous = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (!view || !before) return;
    const change = replayChange(before, view);
    const canvas = useCanvasStore.getState();
    const appeared = [...change.added, ...change.addedEdges];
    if (appeared.length > 0) {
      canvas.markAdded(appeared);
      // The reveal mark is cleared a little after the reveal animation ends, so the animation is never cut short.
      window.setTimeout(() => useCanvasStore.getState().clearAdded(appeared), motionMs('--motion-reveal') + 80);
    }
    if (change.removed.length > 0 && motionMs('--motion-reveal') > 0) {
      const gone = change.removed.map((node) => ({ id: node.id, ...boxOf(node), title: node.data.title || node.data.comfyType }));
      canvas.addFading(gone);
      window.setTimeout(() => useCanvasStore.getState().clearFading(gone.map((node) => node.id)), motionMs('--motion-reveal') * 2 + 80);
    }
    if (change.changed.length > 0) flash({ nodes: change.changed });
    const first = [...change.added, ...change.changed].map((id) => view.nodes.find((node) => node.id === id)).find(Boolean)
      ?? change.removed[0];
    if (first) canvasHandle()?.reveal(boxOf(first));
  }, [view]);
  // Leaving the history: the next time starts fresh.
  useEffect(() => () => {
    previous.current = null;
  }, []);
}
