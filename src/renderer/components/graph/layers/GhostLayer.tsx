import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_IN, tokenSeconds } from '../../../motion/policy';
import { Check, X } from 'lucide-react';
import { getBezierPath, Position, useStore, ViewportPortal } from '@xyflow/react';
import type { Proposal } from '../../../../shared/contracts/proposals';
import type { GraphMutation } from '../../../../shared/commands/types';
import type { NodeClassDetail } from '../../../../shared/contracts/knowledge';
import { instancePorts, type SubgraphDefinition } from '../../../../shared/graph/subgraphs';
import { ghostSpots, openProposals, useProposalsStore } from '../../../state/proposalsState';
import { useGraphStore } from '../../../state/graphState';
import type { ComfyNodeData, PortDefinition } from '../../../types/graph';
import NodeCard from '../nodes/NodeCard';
import { useNodeDetail, useNodeInfoStore } from '../nodeInfo';
import { useCanvasStore } from '../canvasStore';
import { ghostNodePosition, ghostSpotFree, parameterPill, subgraphGhostRect, unplacedOrder, nodeRect, GHOST_SIZE } from '../lib/geometry';
import { newNodeSize } from '../lib/nodeSizes';
import { estimateNodeSize } from '../../../../shared/graph/layout';
import { handlePoint } from '../lib/handles';
import { canvasHandle } from '../../../commands/canvasHandle';
import { useLayoutKey } from '../lib/useLayoutKey';
import { typeColor } from '../lib/typeColors';
import styles from './GhostLayer.module.css';

type Payload<T extends GraphMutation['type']> = Extract<GraphMutation, { type: T }>;

/** Accept / reject chips. Resolution goes only through proposalsState.resolve. */
function Chips({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation();
  const resolve = useProposalsStore((state) => state.resolve);
  const busy = useProposalsStore((state) => state.resolving.includes(proposal.id));
  const replaying = useCanvasStore((state) => Boolean(state.replay));
  const disabled = busy || replaying;
  return (
    <span className={`${styles.chips} ghost-chips nodrag nopan`}>
      <button type="button" className={`${styles.chip} ${styles.accept} ghost-chip`} disabled={disabled} onClick={() => void resolve(proposal.id, 'accept').catch(() => undefined)}>
        <Check size={12} aria-hidden="true" />
        {t('canvas.ghostAccept')}
      </button>
      <button type="button" className={`${styles.chip} ${styles.reject} ghost-chip`} disabled={disabled} onClick={() => void resolve(proposal.id, 'reject').catch(() => undefined)}>
        <X size={12} aria-hidden="true" />
        {t('canvas.ghostReject')}
      </button>
    </span>
  );
}

function Note({ text }: { text: string }) {
  if (!text.trim()) return null;
  return <p className={`${styles.note} ghost-note`} title={text}>{text}</p>;
}

/**
 * How a grey draft comes and goes (motion package). It fades in; once decided it leaves by the decision: an
 * accepted draft fades out quickly where the live node draws itself in (the canvas reveals every new node), so the
 * draft seems to become it; a rejected one dissolves (shrinks, blurs, fades) on the leaving curve.
 * The decision reaches a leaving draft through AnimatePresence's `custom` (its own props are frozen as it leaves).
 */
function fadeFor(id: string) {
  return {
    initial: 'hidden',
    animate: 'shown',
    exit: 'gone',
    variants: {
      hidden: { opacity: 0, scale: 0.97 },
      shown: { opacity: 1, scale: 1 },
      gone: (decisions?: ReadonlyMap<string, string>) => (decisions?.get(id) === 'accepted'
        ? { opacity: 0, transition: { duration: tokenSeconds('--motion-exit'), ease: EASE_IN } }
        : { opacity: 0, scale: 0.9, filter: 'blur(6px)', transition: { duration: tokenSeconds('--motion-reveal'), ease: EASE_IN } }),
    },
  };
}

function catalogPorts(detail: ReturnType<typeof useNodeDetail>): { inputs: PortDefinition[]; outputs: PortDefinition[] } {
  if (!detail) return { inputs: [], outputs: [] };
  const sockets = detail.inputs.filter((input) => !input.widget);
  return {
    inputs: sockets.map((input, index) => ({ id: `in-${index}`, name: input.name, dataType: input.type, optional: !input.required })),
    outputs: detail.outputs.map((output, index) => ({ id: `out-${index}`, name: output.name, dataType: output.type, optional: false })),
  };
}

/** What stands above the ghost's card (the «suggested» flag) and under it (the note, the two buttons), in pixels. */
const GHOST_ABOVE = 26;
const GHOST_NOTE = 65;
const GHOST_BUTTONS = 30;

/**
 * The room an add-node ghost needs: the ghost as drawn (its card shows link inputs and the values it comes with,
 * under a flag and over a note and two buttons) and the node that lands on the same spot once it is accepted,
 * whichever is taller. Before the catalog answered (`undefined`), a size that suits most nodes; `null` is its
 * answer that it does not have the class.
 */
export function ghostRoom(payload: Payload<'add-node'>, detail: NodeClassDetail | null | undefined, hasNote: boolean): { width: number; height: number } {
  if (detail === undefined) return GHOST_SIZE;
  const lands = newNodeSize(payload.nodeType, detail, { parameters: payload.parameters });
  const ports = catalogPorts(detail);
  const card = estimateNodeSize({ inputs: ports.inputs, outputs: ports.outputs, parameters: payload.parameters ?? {} });
  const drawn = GHOST_ABOVE + card.height + (hasNote ? GHOST_NOTE : 0) + GHOST_BUTTONS;
  return { width: Math.max(lands.width, card.width), height: Math.max(lands.height, drawn) };
}

function AddNodeGhost({ proposal, payload, at }: { proposal: Proposal; payload: Payload<'add-node'>; at: { x: number; y: number } }) {
  const { t } = useTranslation();
  const detail = useNodeDetail(payload.nodeType);
  const ports = catalogPorts(detail);
  const title = payload.title || detail?.displayName || payload.nodeType;
  const data: ComfyNodeData = {
    comfyType: payload.nodeType,
    title,
    inputs: ports.inputs,
    outputs: ports.outputs,
    parameters: payload.parameters ?? {},
  };
  return (
    <motion.div {...fadeFor(proposal.id)} className={styles.anchor} style={{ left: at.x, top: at.y }} data-ghost={proposal.id} data-ghost-kind="add-node" aria-label={String(t('canvas.ghostNode', { title }))} role="group">
      <span className={`${styles.flag} ghost-flag`}>{t('canvas.suggested')}</span>
      <NodeCard id={`ghost-${proposal.id}`} data={data} state={{ ghost: true }} connected={new Set()} live={false} />
      <Note text={proposal.note} />
      <Chips proposal={proposal} />
    </motion.div>
  );
}

function ConnectGhost({ proposal, payload }: { proposal: Proposal; payload: Payload<'connect'> }) {
  const { t } = useTranslation();
  const lookup = useStore((state) => state.nodeLookup);
  const nodes = useGraphStore((state) => state.nodes);
  const source = handlePoint(lookup, payload.source, payload.sourceHandle, 'source');
  const target = handlePoint(lookup, payload.target, payload.targetHandle, 'target');
  if (!source || !target) return null;
  const sourceNode = nodes.find((node) => node.id === payload.source);
  const port = sourceNode?.data.outputs.find((item) => item.id === payload.sourceHandle);
  const color = typeColor(port?.dataType);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: source.x, sourceY: source.y, sourcePosition: Position.Right,
    targetX: target.x, targetY: target.y, targetPosition: Position.Left,
  });
  return (
    <motion.div {...fadeFor(proposal.id)} className={styles.layer} data-ghost={proposal.id} data-ghost-kind="connect">
      <svg className={styles.svg} aria-hidden="true">
        <path d={path} className={styles.ghostEdge} style={{ stroke: color }} />
      </svg>
      <div className={styles.midpoint} style={{ left: labelX, top: labelY }} role="group" aria-label={String(t('canvas.ghostConnect'))}>
        <Note text={proposal.note} />
        <Chips proposal={proposal} />
      </div>
    </motion.div>
  );
}

function ParameterGhost({ proposal, payload }: { proposal: Proposal; payload: Payload<'set-parameter'> }) {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const pill = parameterPill(payload, nodes);
  const node = nodes.find((item) => item.id === payload.nodeId);
  if (!node) return null;
  const rect = nodeRect(node);
  return (
    <motion.div {...fadeFor(proposal.id)} className={styles.anchor} style={{ left: rect.x + rect.width + 12, top: rect.y }} data-ghost={proposal.id} data-ghost-kind="set-parameter" role="group" aria-label={String(t('canvas.ghostParameter'))}>
      <span className={styles.pill}>{pill.text}</span>
      <Note text={proposal.note} />
      <Chips proposal={proposal} />
    </motion.div>
  );
}

function SubgraphGhost({ proposal, payload }: { proposal: Proposal; payload: Payload<'create-subgraph'> }) {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const rect = subgraphGhostRect(payload, nodes);
  if (!rect) return null;
  return (
    <motion.div {...fadeFor(proposal.id)} className={styles.outline} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} data-ghost={proposal.id} data-ghost-kind="create-subgraph" role="group" aria-label={String(t('canvas.ghostSubgraph', { name: payload.name }))}>
      <div className={styles.outlineTitle}>
        <span className={`${styles.flag} ghost-flag`}>{t('canvas.suggested')}</span>
        <span>{payload.name}</span>
        <Chips proposal={proposal} />
      </div>
      <Note text={proposal.note} />
    </motion.div>
  );
}

/** The room the ghost of a suggested subgraph needs: its card with its ports, the flag, the note, the buttons. */
export function insertRoom(definition: Pick<SubgraphDefinition, 'name' | 'inputs' | 'outputs'> | undefined, title: string | undefined, hasNote: boolean): { width: number; height: number } {
  if (!definition) return GHOST_SIZE;
  const card = estimateNodeSize(
    { inputs: definition.inputs, outputs: definition.outputs, kind: 'subgraph-instance', title: title || definition.name },
    { subgraphName: definition.name },
  );
  return { width: card.width, height: GHOST_ABOVE + card.height + (hasNote ? GHOST_NOTE : 0) + GHOST_BUTTONS };
}

function InsertGhost({ proposal, payload, at }: { proposal: Proposal; payload: Payload<'insert-subgraph'>; at: { x: number; y: number } }) {
  const { t } = useTranslation();
  const definition = useGraphStore((state) => state.subgraphs.find((item) => item.id === payload.definitionId));
  const ports = definition ? instancePorts(definition) : { inputs: [], outputs: [] };
  const data: ComfyNodeData = {
    comfyType: payload.definitionId,
    kind: 'subgraph-instance',
    title: payload.title || definition?.name || payload.definitionId,
    inputs: ports.inputs,
    outputs: ports.outputs,
    parameters: {},
  };
  return (
    <motion.div {...fadeFor(proposal.id)} className={styles.anchor} style={{ left: at.x, top: at.y }} data-ghost={proposal.id} data-ghost-kind="insert-subgraph" role="group" aria-label={String(t('canvas.ghostInsert'))}>
      <span className={`${styles.flag} ghost-flag`}>{t('canvas.suggested')}</span>
      <NodeCard id={`ghost-${proposal.id}`} data={data} state={{ ghost: true, subgraph: true }} connected={new Set()} live={false} />
      <Note text={proposal.note} />
      <Chips proposal={proposal} />
    </motion.div>
  );
}

function RemoveGhost({ proposal, payload }: { proposal: Proposal; payload: Payload<'remove-node'> }) {
  const { t } = useTranslation();
  const node = useGraphStore((state) => state.nodes.find((item) => item.id === payload.nodeId));
  if (!node) return null;
  const rect = nodeRect(node);
  return (
    <motion.div {...fadeFor(proposal.id)} className={`${styles.outline} ${styles.removal}`} style={{ left: rect.x - 8, top: rect.y - 8, width: rect.width + 16, height: rect.height + 16 }} data-ghost={proposal.id} data-ghost-kind="remove-node" role="group" aria-label={String(t('canvas.ghostRemove'))}>
      <div className={styles.outlineTitle}>
        <span className={`${styles.flag} ghost-flag`}>{t('canvas.ghostRemove')}</span>
        <Chips proposal={proposal} />
      </div>
      <Note text={proposal.note} />
    </motion.div>
  );
}

/**
 * Proposals as ghosts over the canvas. Drawn in flow coordinates through ViewportPortal so ghosts are not
 * React Flow nodes: they never count as graph nodes, never commit, and vanish (fade) once resolved.
 */
export default function GhostLayer() {
  const proposals = useProposalsStore((state) => state.proposals);
  const nodes = useGraphStore((state) => state.nodes);
  const inDefinition = useGraphStore((state) => state.activeSubgraphId !== null);
  const replaying = useCanvasStore((state) => Boolean(state.replay));
  useLayoutKey();
  const open = useMemo(() => openProposals(proposals), [proposals]);
  // What became of each draft, for the way a decided one leaves (fadeFor).
  const decisions = useMemo(() => new Map(proposals.map((proposal) => [proposal.id, proposal.status as string])), [proposals]);
  const order = useMemo(() => unplacedOrder(open), [open]);
  // A ghost keeps the spot it first got, so selecting another node does not make it jump. It moves only when a
  // node came to lie under it (a build tidied the graph, the person dragged a node there).
  const placed = useRef(new Map<string, { x: number; y: number }>());
  const openIds = new Set(open.map((proposal) => proposal.id));
  for (const id of placed.current.keys()) if (!openIds.has(id)) placed.current.delete(id);
  for (const id of ghostSpots.keys()) if (!openIds.has(id)) ghostSpots.delete(id);
  const details = useNodeInfoStore((state) => state.details);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const spotOf = (proposal: Proposal, payload: { x?: number; y?: number }, room: { width: number; height: number }) => {
    const known = placed.current.get(proposal.id);
    if (known && ghostSpotFree(known, nodes, room)) return known;
    const spot = ghostNodePosition(payload, nodes, order.get(proposal.id) ?? 0, room);
    // Accepting lands the node here (proposalsState.resolve sends it).
    ghostSpots.set(proposal.id, spot);
    // Remember it only once the graph is on screen and measured; before that the spot is provisional.
    if (nodes.length > 0 && nodes.every((node) => node.measured?.height)) placed.current.set(proposal.id, spot);
    return spot;
  };
  // A new draft the person cannot see (motion package): the camera brings it into view once, by the camera rule.
  // A draft that is already on screen leaves the camera alone.
  const shownDrafts = useRef(new Set<string>());
  const freshKey = open.map((proposal) => proposal.id).filter((id) => !shownDrafts.current.has(id)).join(' ');
  useEffect(() => {
    if (!freshKey || inDefinition || replaying) return;
    const ids = freshKey.split(' ');
    ids.forEach((id) => shownDrafts.current.add(id));
    // After the draft is drawn and its spot known (spotOf runs while drawing).
    const frame = window.requestAnimationFrame(() => {
      const spot = ids.map((id) => ghostSpots.get(id)).find(Boolean);
      if (spot) canvasHandle()?.reveal({ x: spot.x, y: spot.y, width: GHOST_SIZE.width, height: GHOST_SIZE.height });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [freshKey, inDefinition, replaying]);
  if (inDefinition || replaying) return null;
  return (
    <ViewportPortal>
      <div className={styles.root}>
        <AnimatePresence custom={decisions}>
          {open.map((proposal) => {
            const payload = proposal.payload;
            switch (payload.type) {
              case 'add-node':
                return <AddNodeGhost key={proposal.id} proposal={proposal} payload={payload} at={spotOf(proposal, payload, ghostRoom(payload, details[payload.nodeType], Boolean(proposal.note)))} />;
              case 'connect':
                return <ConnectGhost key={proposal.id} proposal={proposal} payload={payload} />;
              case 'set-parameter':
                return <ParameterGhost key={proposal.id} proposal={proposal} payload={payload} />;
              case 'create-subgraph':
                return <SubgraphGhost key={proposal.id} proposal={proposal} payload={payload} />;
              case 'insert-subgraph':
                return <InsertGhost key={proposal.id} proposal={proposal} payload={payload} at={spotOf(proposal, payload, insertRoom(subgraphs.find((item) => item.id === payload.definitionId), payload.title, Boolean(proposal.note)))} />;
              case 'remove-node':
                return <RemoveGhost key={proposal.id} proposal={proposal} payload={payload} />;
              default:
                return null;
            }
          })}
        </AnimatePresence>
      </div>
    </ViewportPortal>
  );
}
