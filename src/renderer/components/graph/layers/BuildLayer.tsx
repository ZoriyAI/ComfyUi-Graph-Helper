import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeToolbar, Position } from '@xyflow/react';
import { useGraphStore } from '../../../state/graphState';
import { useUiStore } from '../../../state/uiState';
import { useProjectionStore } from '../../../services/commands/projection';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import Illustration from '../illustrations/Illustration';
import { useCanvasStore } from '../canvasStore';
import { changedNodes, diffGraph, revealSteps } from '../lib/graphDiff';
import { motionLevel, motionMs, readingPaceMs, useMotionLevel } from '../lib/motion';
import { useNodeInfoStore } from '../nodeInfo';
import { useCenterOn } from './TourLayer';
import { useDescriptionCardShown } from './DescriptionLayer';
import styles from './Callout.module.css';

/** How long the "changed by the helper" mark stays on a node after an agent edit. */
const AI_MARK_MS = 6000;

function later(ms: number, run: () => void): void {
  window.setTimeout(run, ms);
}

/**
 * Real events, shown at a readable pace.
 * - Every projection that adds nodes or edges marks them for the one-time reveal (draw-in, fade-in).
 * - While an agent run is committing (activeRun), new nodes and edges queue up and appear one by one with a
 *   short callout about the node; "follow the helper" pans to each. "Show all now" (toolbar) empties the queue.
 * - Nodes an agent commit added or changed pulse once and carry the AI mark for a few seconds.
 * Manual commits (canvas/commit.ts) never queue: the person already sees what they did.
 */
export default function BuildLayer() {
  const { t } = useTranslation();
  const motion = useMotionLevel();
  const pending = useCanvasStore((state) => state.pending);
  const callout = useCanvasStore((state) => state.callout);
  const centerOn = useCenterOn();
  // With description cards on, the revealed node's card expands and carries the text; no second callout.
  const inCard = useDescriptionCardShown(callout?.nodeId);
  const previous = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);

  useEffect(() => {
    // The first projection after start-up is not an event to reveal; later ones are.
    if (useProjectionStore.getState().revSeq > 0) {
      const graph = useGraphStore.getState();
      previous.current = { nodes: graph.nodes, edges: graph.edges };
    }
  }, []);

  useEffect(() => useGraphStore.subscribe((state, before) => {
    if (state.nodes === before.nodes && state.edges === before.edges) return;
    const prior = previous.current;
    previous.current = { nodes: state.nodes, edges: state.edges };
    if (!prior) return;
    const canvas = useCanvasStore.getState();
    const diff = diffGraph(prior, state);
    // A drag only moves positions; nothing appears.
    if (diff.addedNodes.length === 0 && diff.addedEdges.length === 0 && state.nodes.length === prior.nodes.length) {
      if (!useProjectionStore.getState().activeRun || canvas.manualInFlight > 0) return;
    }
    const agent = Boolean(useProjectionStore.getState().activeRun) && canvas.manualInFlight === 0;
    const added = [...diff.addedNodes, ...diff.addedEdges];
    if (agent) {
      const touched = [...diff.addedNodes, ...changedNodes(prior.nodes, state.nodes)];
      if (touched.length > 0) {
        canvas.markAiTouched(touched);
        later(AI_MARK_MS, () => useCanvasStore.getState().clearAiTouched(touched));
      }
    }
    if (added.length === 0) return;
    if (agent && motionLevel() === 'full') {
      const steps = revealSteps(diff, state.edges).map((step) => step.id);
      canvas.setPending([...canvas.pending, ...steps.filter((id) => !canvas.pending.includes(id))]);
      return;
    }
    canvas.markAdded(added);
    later(motionMs('--motion-reveal', 320) + 80, () => useCanvasStore.getState().clearAdded(added));
    if (agent && useUiStore.getState().followAgent && diff.addedNodes.length > 0) {
      later(0, () => centerOn(diff.addedNodes[diff.addedNodes.length - 1]));
    }
  }), [centerOn]);

  const head = pending[0];
  useEffect(() => {
    if (!head) return undefined;
    const timer = window.setTimeout(() => {
      const canvas = useCanvasStore.getState();
      if (canvas.pending[0] !== head) return;
      canvas.setPending(canvas.pending.slice(1));
      canvas.markAdded([head]);
      later(motionMs('--motion-reveal', 320) + 80, () => useCanvasStore.getState().clearAdded([head]));
      const node = useGraphStore.getState().nodes.find((item) => item.id === head);
      if (!node) return;
      const detail = useNodeInfoStore.getState().details[node.data.comfyType];
      void useNodeInfoStore.getState().request(node.data.comfyType);
      const purpose = useGraphStore.getState().components.find((item) => item.ownerKind === 'node' && item.ownerId === node.id)?.purpose;
      canvas.setCallout({
        nodeId: node.id,
        title: node.data.title || detail?.displayName || node.data.comfyType,
        text: purpose?.trim() || node.data.annotations?.[0] || detail?.description?.trim() || String(t('canvas.builtByHelper')),
      });
      if (useUiStore.getState().followAgent) centerOn(node.id);
    }, readingPaceMs());
    return () => window.clearTimeout(timer);
  }, [head, centerOn, t]);

  // The callout stays a little after the last step, then closes.
  useEffect(() => {
    if (pending.length > 0 || !callout) return undefined;
    const timer = window.setTimeout(() => useCanvasStore.getState().setCallout(null), readingPaceMs() * 3);
    return () => window.clearTimeout(timer);
  }, [pending.length, callout]);

  if (!callout || inCard) return null;
  return (
    <NodeToolbar nodeId={callout.nodeId} isVisible position={Position.Bottom} offset={12}>
      <section className={`${styles.callout} ${styles.build}`} aria-live="polite" aria-label={callout.title}>
        <div className={styles.body}>
          <Illustration key={callout.nodeId} classType={useGraphStore.getState().nodes.find((node) => node.id === callout.nodeId)?.data.comfyType} animate={motion === 'full'} />
          <div>
            <h3 className={styles.title}>{callout.title}</h3>
            <p className={styles.text}>{callout.text}</p>
          </div>
        </div>
      </section>
    </NodeToolbar>
  );
}

/** "Show all now": reveal everything still queued at once. */
export function revealAllNow(): void {
  const canvas = useCanvasStore.getState();
  const ids = canvas.pending;
  if (ids.length === 0) return;
  canvas.setPending([]);
  canvas.markAdded(ids);
  later(motionMs('--motion-reveal', 320) + 80, () => useCanvasStore.getState().clearAdded(ids));
}
