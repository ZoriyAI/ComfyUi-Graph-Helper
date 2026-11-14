import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ComfyNodeData } from '../../../types/graph';
import NodeCard from './NodeCard';
import SubgraphNode from './SubgraphNode';
import { useConnectedHandles } from './PortHandle';
import { useNodeFlags } from './nodeFlags';
import { CollapsedNode, RerouteNode } from './EditorNodes';
import { editorKind, isCollapsed } from '../../../../shared/workflow/comfyLook';

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

export default memo(ComfyNode);
