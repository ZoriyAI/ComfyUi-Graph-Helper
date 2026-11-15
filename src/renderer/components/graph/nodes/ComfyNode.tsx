/**
 * The React Flow node type "comfy": every graph node on the canvas goes through it. CanvasFlow registers it in
 * nodeTypes. It picks the drawing (a collapsed row, a Reroute dot, a subgraph instance or the full NodeCard) and is
 * memoised on id, data and selection only, which tests/unit/motionPolicy.test.ts protects for zoom speed.
 */
import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ComfyNodeData } from '../../../types/graph';
import NodeCard from './NodeCard';
import SubgraphNode from './SubgraphNode';
import { useConnectedHandles } from './PortHandle';
import { useNodeFlags } from './nodeFlags';
import { CollapsedNode, RerouteNode } from './EditorNodes';
import { editorKind, isCollapsed } from '../../../../shared/workflow/comfyLook';

/** Chooses how one node is drawn, as the file saved it. */
function ComfyNode({ id, data: rawData, selected }: NodeProps) {
  const data = rawData as ComfyNodeData;
  const flags = useNodeFlags(id);
  const connected = useConnectedHandles(id);
  // As the file saved it: a collapsed node is one title row, a Reroute a dot (shared/workflow/comfyLook.ts).
  if (isCollapsed(data)) return <CollapsedNode id={id} data={data} selected={Boolean(selected)} />;
  if (data.kind !== 'subgraph-instance' && editorKind(data.comfyType) === 'reroute') return <RerouteNode id={id} data={data} selected={Boolean(selected)} />;
  if (data.kind === 'subgraph-instance') return <SubgraphNode id={id} data={data} selected={Boolean(selected)} />;
  return <NodeCard id={id} data={data} connected={connected} state={{ ...flags, selected: Boolean(selected) }} />;
}

/**
 * Redrawn only when what it shows changes: its data or its selection. React Flow also passes the measured size and
 * the position, which change for every node at once when the overview level folds or unfolds the cards; redrawing
 * a thousand cards for that took seconds (motion package, zoom performance).
 */
export function sameNodeProps(previous: Pick<NodeProps, 'id' | 'data' | 'selected'>, next: Pick<NodeProps, 'id' | 'data' | 'selected'>): boolean {
  return previous.id === next.id && previous.data === next.data && previous.selected === next.selected;
}

export default memo(ComfyNode, sameNodeProps);
