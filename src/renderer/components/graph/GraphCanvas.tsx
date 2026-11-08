import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const fitPadding = { top: '40px', right: '24px', bottom: '112px', left: '168px' } as const;

function ZoomReporter() {
  const { zoom } = useViewport();
  const setZoom = useGraphStore((state) => state.setZoom);
  useEffect(() => {
    setZoom(zoom);
  }, [setZoom, zoom]);
  return null;
}

export default function GraphCanvas() {
  const { t } = useTranslation();
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
        <p className="canvas-empty">{t('graph.empty')}</p>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onBeforeDelete={() => {
          const active = document.activeElement;
          const inGraph = active instanceof Element && active.closest('.react-flow') != null;
          const blocked = active instanceof Element && active.closest('[role="dialog"], [role="listbox"], .select-content') != null;
          return Promise.resolve(inGraph && !blocked);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: fitPadding, duration: fitDuration }}
        minZoom={0.1}
        maxZoom={2}
        multiSelectionKeyCode={['Meta', 'Control']}
        ariaLabelConfig={{
          'node.a11yDescription.default': String(t('graph.nodeDefault')),
          'node.a11yDescription.keyboardDisabled': String(t('graph.nodeKeyboard')),
          'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => String(t('graph.nodeMoved', { direction, x, y })),
          'edge.a11yDescription.default': String(t('graph.edgeDefault')),
          'controls.ariaLabel': String(t('graph.controls')),
          'controls.zoomIn.ariaLabel': String(t('graph.zoomIn')),
          'controls.zoomOut.ariaLabel': String(t('graph.zoomOut')),
          'controls.fitView.ariaLabel': String(t('graph.fitView')),
          'controls.interactive.ariaLabel': String(t('graph.interactive')),
          'minimap.ariaLabel': String(t('graph.minimap')),
          'handle.ariaLabel': String(t('graph.handle')),
        }}
      >
        <ZoomReporter />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls position="top-left" fitViewOptions={{ padding: fitPadding, duration: fitDuration }} />
        <MiniMap
          position="bottom-left"
          style={{ width: 144, height: 96 }}
          nodeStrokeWidth={1}
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
