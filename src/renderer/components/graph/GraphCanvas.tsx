import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BaseEdge,
  getBezierPath,
  Connection,
  NodeTypes,
  EdgeProps,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../state/graphState';
import { fitDurationMs } from '../../motion/policy';
import ComfyNode from './nodes/ComfyNode';
import { submitManual } from '../../services/commands/projection';

const nodeTypes: NodeTypes = {
  comfy: ComfyNode,
};

const TYPE_STROKE: Record<string, string> = {
  IMAGE: 'var(--type-image)',
  LATENT: 'var(--type-latent)',
  MODEL: 'var(--type-model)',
  CONDITIONING: 'var(--type-conditioning)',
  VAE: 'var(--type-vae)',
  CLIP: 'var(--type-clip)',
};

function typeStroke(dataType: unknown) {
  return TYPE_STROKE[String(dataType)] || 'var(--type-unknown)';
}

function TypedEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const record = data as { dataType?: string } | undefined;
  return (
    <BaseEdge
      path={path}
      style={{ stroke: typeStroke(record?.dataType), strokeWidth: selected ? 2.5 : 1.75 }}
    />
  );
}

const edgeTypes = { default: TypedEdge };

function ZoomReporter() {
  const { zoom } = useViewport();
  const setZoom = useGraphStore((state) => state.setZoom);
  useEffect(() => {
    setZoom(zoom);
  }, [setZoom, zoom]);
  return null;
}

export default function GraphCanvas() {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [fitDuration, setFitDuration] = useState(() => fitDurationMs());

  useEffect(() => {
    const read = () => setFitDuration(fitDurationMs());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', read);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', read);
    };
  }, []);

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
    <div className="graph-canvas" data-fit-duration={fitDuration}>
      {nodes.length === 0 ? (
        <p className="canvas-empty">The graph is empty. Import a workflow or describe a change.</p>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2, duration: fitDuration }}
        minZoom={0.1}
        maxZoom={2}
      >
        <ZoomReporter />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls position="top-left" />
        <MiniMap
          position="bottom-left"
          nodeStrokeWidth={3}
          className="graph-minimap"
          nodeColor={(node) => {
            const data = node.data as { outputs?: Array<{ dataType?: string }>; inputs?: Array<{ dataType?: string }> };
            return typeStroke(data.outputs?.[0]?.dataType || data.inputs?.[0]?.dataType);
          }}
        />
      </ReactFlow>
    </div>
  );
}
