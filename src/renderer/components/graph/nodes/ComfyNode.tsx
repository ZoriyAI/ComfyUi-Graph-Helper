import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ComfyNodeData } from '../../../types/graph';
import NodeCard from './NodeCard';
import SubgraphNode from './SubgraphNode';
import { useConnectedHandles } from './PortHandle';
import { useNodeFlags } from './nodeFlags';

function ComfyNode({ id, data: rawData, selected }: NodeProps) {
  const data = rawData as ComfyNodeData;
  const flags = useNodeFlags(id);
  const connected = useConnectedHandles(id);
  if (data.kind === 'subgraph-instance') return <SubgraphNode id={id} data={data} selected={Boolean(selected)} />;
  return <NodeCard id={id} data={data} connected={connected} state={{ ...flags, selected: Boolean(selected) }} />;
}

export default memo(ComfyNode);
