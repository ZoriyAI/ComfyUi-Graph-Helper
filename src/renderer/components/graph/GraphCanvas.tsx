import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../state/graphState';
import ComfyNode from './nodes/ComfyNode';
import { submitManual } from '../../services/commands/projection';

const nodeTypes: NodeTypes = {
  comfy: ComfyNode,
};

export default function GraphCanvas() {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const local = changes.filter((change) => change.type !== 'remove');
      if (local.length > 0) {
        setNodes(applyNodeChanges(local, nodes) as typeof nodes);
      }
      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.position) {
          void submitManual(`manual-${crypto.randomUUID()}`, {
            type: 'move-node',
            nodeId: change.id,
            x: change.position.x,
            y: change.position.y,
          });
        }
        if (change.type === 'remove') {
          void submitManual(`manual-${crypto.randomUUID()}`, { type: 'remove-node', nodeId: change.id });
        }
      }
    },
    [nodes, setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const local = changes.filter((change) => change.type !== 'remove');
      if (local.length > 0) {
        setEdges(applyEdgeChanges(local, edges) as typeof edges);
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          void submitManual(`manual-${crypto.randomUUID()}`, { type: 'remove-edge', edgeId: change.id });
        }
      }
    },
    [edges, setEdges]
  );

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;
    void submitManual(`manual-${crypto.randomUUID()}`, {
      type: 'connect',
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    });
  }, []);

  return (
    <div className="graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} className="graph-minimap" />
      </ReactFlow>
    </div>
  );
}
