import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { NodeToolbar, Position, ViewportPortal, useReactFlow } from '@xyflow/react';
import { useGraphStore } from '../../../state/graphState';
import { useUiStore } from '../../../state/uiState';
import { useProjectionStore } from '../../../services/commands/projection';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import { toolLabelKey } from '../../chat/toolPresentation';
import Illustration from '../illustrations/Illustration';
import { useCanvasStore, type BuildCallout, type FadingNode } from '../canvasStore';
import { changedNodes, diffGraph, revealSteps } from '../lib/graphDiff';
import { currentPreferences } from '../../../state/preferencesState';
import { CALLOUT_HOLD_MS, calloutText, parameterChanges, stepCounter, stepDelayMs, type BuildItem } from '../lib/buildQueue';
import { motionLevel, motionMs, useMotionLevel } from '../lib/motion';
import { useNodeInfoStore } from '../nodeInfo';
import { useCenterOn } from './TourLayer';
import styles from './Callout.module.css';

/** How long the "changed by the helper" mark stays on a node after an agent edit. */
const AI_MARK_MS = 6000;
/** Screen pixels the camera rises when following, so the bubble above the node stays in view. */
const BUBBLE_LIFT_PX = 110;
/** Following never zooms in past this, so the next steps around the node stay in view. */
const FOLLOW_MAX_ZOOM = 1.1;

function later(ms: number, run: () => void): void {
  window.setTimeout(run, ms);
}

function revealMs(): number {
  return motionMs('--motion-reveal', 320);
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function nodeTitle(node: GraphNode | undefined, fallback: string): string {
  if (!node) return fallback;
  const detail = useNodeInfoStore.getState().details[node.data.comfyType];
  return node.data.title || detail?.displayName || node.data.comfyType || fallback;
}

/** The callout for one revealed item, from what the build-step chunk said and what the graph already knows. */
function calloutFor(item: BuildItem, t: Translate): BuildCallout | null {
  const graph = useGraphStore.getState();
  const canvas = useCanvasStore.getState();
  const anchor = graph.nodes.find((node) => node.id === item.anchor);
  if (!anchor) return null;
  const info = canvas.stepInfo[item.key];
  const step = stepCounter(canvas.live.shown, canvas.queue.length);
  const base = { nodeId: anchor.id, key: item.key, kind: item.kind, step, change: item.change };
  if (item.kind === 'node') {
    void useNodeInfoStore.getState().request(anchor.data.comfyType);
    const detail = useNodeInfoStore.getState().details[anchor.data.comfyType];
    const purpose = graph.components.find((entry) => entry.ownerKind === 'node' && entry.ownerId === anchor.id)?.purpose;
    return {
      ...base,
      toolName: info?.toolName ?? 'addNode',
      title: nodeTitle(anchor, anchor.data.comfyType),
      text: calloutText({ why: info?.why, purpose, annotation: anchor.data.annotations?.[0], catalog: detail?.description, fallback: t('canvas.builtByHelper') }),
    };
  }
  if (item.kind === 'edge') {
    const edge = graph.edges.find((entry) => entry.id === item.key);
    const source = graph.nodes.find((node) => node.id === edge?.source);
    const from = nodeTitle(source, edge?.source ?? '');
    const to = nodeTitle(anchor, anchor.id);
    return {
      ...base,
      toolName: info?.toolName ?? 'connectNodes',
      title: t('canvas.buildConnectTitle', { from, to }),
      text: calloutText({ why: info?.why, fallback: t('canvas.buildConnected', { from, to }) }),
    };
  }
  return {
    ...base,
    toolName: info?.toolName ?? 'setParameter',
    title: nodeTitle(anchor, anchor.id),
    text: calloutText({ why: info?.why, fallback: '' }),
  };
}

/** Shows one item now: marks it for the reveal animation, counts it, opens its callout, follows it. */
function reveal(item: BuildItem, t: Translate, centerOn: (nodeId: string) => void): void {
  const canvas = useCanvasStore.getState();
  if (item.kind !== 'param') {
    canvas.markAdded([item.key]);
    later(revealMs() + 80, () => useCanvasStore.getState().clearAdded([item.key]));
  }
  canvas.setLive({ ...canvas.live, shown: canvas.live.shown + 1 });
  const callout = calloutFor(item, t);
  if (!callout) return;
  canvas.setCallout(callout);
  if (callout.text) canvas.setLive({ ...useCanvasStore.getState().live, why: callout.text });
  if (useUiStore.getState().followAgent) centerOn(callout.nodeId);
}

function fadingOf(nodes: GraphNode[]): FadingNode[] {
  return nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? 220,
    height: node.measured?.height ?? node.height ?? 90,
    title: node.data.title || node.data.comfyType,
  }));
}

/**
 * The live build: real commits, shown at a readable pace.
 * - While an agent run is committing, every new node, edge and changed field becomes one step. Steps appear one
 *   at a time (edges after their ends), each with a speech-bubble callout next to the node: the agent's `why`
 *   from the build-step chunk, the tool, and "3/7". The callout stays ~4 s or until the next step, then the
 *   node's description card (which already holds the saved why) takes over.
 * - Reduced motion: the same sequence without animation. Motion off: everything at once, the last step's callout
 *   with its number.
 * - Removed nodes fade where they stood. Changed fields show "old → new".
 * Manual commits (canvas/commit.ts) never queue: the person already sees what they did.
 */
export default function BuildLayer() {
  const { t } = useTranslation();
  const translate: Translate = (key, options) => String(options ? t(key, options) : t(key));
  const translateRef = useRef(translate);
  translateRef.current = translate;
  const motion = useMotionLevel();
  const queue = useCanvasStore((state) => state.queue);
  const callout = useCanvasStore((state) => state.callout);
  const fading = useCanvasStore((state) => state.fading);
  const centerRequest = useCanvasStore((state) => state.centerRequest);
  const centerNode = useCenterOn();
  const flow = useReactFlow();
  // Following the build: centre a little above the node so its bubble (above it) and the strip both fit.
  const centerOn = useCallback((nodeId: string) => {
    const node = flow.getInternalNode(nodeId);
    if (!node) return;
    const zoom = Math.min(FOLLOW_MAX_ZOOM, Math.max(flow.getZoom(), 0.85));
    const width = node.measured?.width ?? 240;
    const height = node.measured?.height ?? 120;
    const at = node.internals.positionAbsolute;
    void flow.setCenter(at.x + width / 2, at.y + height / 2 - BUBBLE_LIFT_PX / zoom, { zoom, duration: motionMs('--motion-tour', 600) });
  }, [flow]);
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
    const activeRun = useProjectionStore.getState().activeRun;
    const agent = Boolean(activeRun) && canvas.manualInFlight === 0;
    const diff = diffGraph(prior, state);
    const remaining = new Set(state.nodes.map((node) => node.id));
    const removed = prior.nodes.filter((node) => !remaining.has(node.id));
    const params = agent ? parameterChanges(prior.nodes, state.nodes) : [];
    // A drag only moves positions; nothing appears.
    if (diff.addedNodes.length === 0 && diff.addedEdges.length === 0 && removed.length === 0 && params.length === 0) {
      if (!agent) return;
    }
    if (agent && activeRun && canvas.live.runId !== activeRun.runId) {
      useCanvasStore.setState({ live: { runId: activeRun.runId, shown: 0, why: '' }, stepInfo: {} });
    }
    if (agent) {
      const touched = [...diff.addedNodes, ...changedNodes(prior.nodes, state.nodes)];
      if (touched.length > 0) {
        canvas.markAiTouched(touched);
        later(AI_MARK_MS, () => useCanvasStore.getState().clearAiTouched(touched));
      }
      if (removed.length > 0 && motionLevel() === 'full') {
        const gone = fadingOf(removed);
        canvas.addFading(gone);
        later(revealMs() * 2 + 80, () => useCanvasStore.getState().clearFading(gone.map((node) => node.id)));
      }
    }
    const added = [...diff.addedNodes, ...diff.addedEdges];
    if (!agent) {
      if (added.length === 0) return;
      canvas.markAdded(added);
      later(revealMs() + 80, () => useCanvasStore.getState().clearAdded(added));
      return;
    }
    const edgeTarget = new Map(state.edges.map((edge) => [edge.id, edge.target]));
    const items: BuildItem[] = [
      ...revealSteps(diff, state.edges).map((step): BuildItem => ({
        key: step.id,
        kind: step.kind,
        anchor: step.kind === 'edge' ? edgeTarget.get(step.id) ?? step.id : step.id,
      })),
      ...params,
    ];
    if (removed.length > 0) {
      // A removal has nothing left to point at: it counts as a step and the strip says why.
      const latest = useCanvasStore.getState();
      latest.setLive({ ...latest.live, shown: latest.live.shown + removed.length });
    }
    if (items.length === 0) return;
    const current = useCanvasStore.getState();
    if (motionLevel() === 'off') {
      // Everything at once; the last step keeps a numbered callout.
      for (const item of items) reveal(item, translateRef.current, centerOn);
      return;
    }
    const known = new Set(current.queue.map((item) => item.key));
    current.setQueue([...current.queue, ...items.filter((item) => !known.has(item.key))]);
  }), [centerOn]);

  // The head of the queue appears after the reading pace; the next one waits for it.
  const head = queue[0];
  useEffect(() => {
    if (!head) return undefined;
    const delay = stepDelayMs({
      revealMs: revealMs(),
      motion: motionLevel(),
      follow: useUiStore.getState().followAgent,
      queued: useCanvasStore.getState().queue.length,
      paceMs: currentPreferences().canvas.buildPaceMs,
    });
    const timer = window.setTimeout(() => {
      const canvas = useCanvasStore.getState();
      if (canvas.queue[0] !== head) return;
      canvas.setQueue(canvas.queue.slice(1));
      reveal(head, translateRef.current, centerOn);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [head, centerOn]);

  // A callout stays ~4 s unless the next step replaces it; then the description card carries the text.
  useEffect(() => {
    if (!callout) return undefined;
    const timer = window.setTimeout(() => {
      if (useCanvasStore.getState().callout === callout) useCanvasStore.getState().setCallout(null);
    }, CALLOUT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [callout]);

  // "Show" on a chat build card: centre the node and select it.
  useEffect(() => {
    if (!centerRequest) return;
    const nodeId = centerRequest.nodeId;
    if (!flow.getInternalNode(nodeId)) return;
    centerNode(nodeId);
    useGraphStore.getState().setNodes(useGraphStore.getState().nodes.map((node) => (
      node.selected === (node.id === nodeId) ? node : { ...node, selected: node.id === nodeId }
    )));
  }, [centerRequest, centerNode, flow]);

  const anchor = callout ? useGraphStore.getState().nodes.find((node) => node.id === callout.nodeId) : undefined;
  const toolKey = callout?.toolName ? toolLabelKey(callout.toolName) : null;
  return (
    <>
      {fading.length > 0 ? (
        <ViewportPortal>
          {fading.map((node) => (
            <div
              key={node.id}
              className={styles.fading}
              data-fading-node={node.id}
              aria-hidden="true"
              style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: node.width, height: node.height }}
            >
              {node.title}
            </div>
          ))}
        </ViewportPortal>
      ) : null}
      {callout && anchor ? (
        <NodeToolbar nodeId={callout.nodeId} isVisible position={Position.Top} offset={18} className="nopan nodrag">
          <section
            key={callout.key ?? callout.nodeId}
            className={`${styles.callout} ${styles.build} ${styles.bubble}`}
            data-build-callout={callout.key ?? callout.nodeId}
            data-build-kind={callout.kind ?? 'node'}
            aria-live="polite"
            aria-label={callout.title}
          >
            <div className={styles.head}>
              <span className={styles.tool}>{toolKey ? t(toolKey) : t('canvas.builtByHelper')}</span>
              {callout.step ? (
                <span className={styles.counter} aria-label={String(t('canvas.buildStep', { index: callout.step.index, count: callout.step.total }))}>
                  {callout.step.index}/{callout.step.total}
                </span>
              ) : null}
            </div>
            <div className={callout.kind === 'node' || !callout.kind ? styles.body : styles.plain}>
              {callout.kind === 'node' || !callout.kind ? (
                <Illustration key={callout.nodeId} classType={anchor.data.comfyType} animate={motion === 'full'} />
              ) : null}
              <div>
                <h3 className={styles.title}>{callout.title}</h3>
                {callout.change ? (
                  <p className={styles.change} data-build-change={callout.change.key}>
                    <span className={styles.changeKey}>{callout.change.key}</span>
                    <span className={styles.old}>{callout.change.from}</span>
                    <ArrowRight size={12} aria-label={String(t('canvas.buildChangedTo'))} />
                    <span className={styles.new}>{callout.change.to}</span>
                  </p>
                ) : null}
                {callout.text ? <p className={styles.text} data-build-why>{callout.text}</p> : null}
              </div>
            </div>
          </section>
        </NodeToolbar>
      ) : null}
    </>
  );
}

/** "Show all now": reveal everything still queued at once. */
export function revealAllNow(): void {
  const canvas = useCanvasStore.getState();
  const items = canvas.queue;
  if (items.length === 0) return;
  canvas.setQueue([]);
  const ids = items.filter((item) => item.kind !== 'param').map((item) => item.key);
  canvas.markAdded(ids);
  canvas.setLive({ ...canvas.live, shown: canvas.live.shown + items.length });
  later(revealMs() + 80, () => useCanvasStore.getState().clearAdded(ids));
}
