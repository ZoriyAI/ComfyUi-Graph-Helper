import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, BackgroundVariant, } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../state/graphState';
import ComfyNode from './nodes/ComfyNode';
const nodeTypes = {
    comfy: ComfyNode,
};
export default function GraphCanvas() {
    const { nodes, edges, setNodes, setEdges, addEdge } = useGraphStore();
    const onNodesChange = useCallback((changes) => {
        setNodes(applyNodeChanges(changes, nodes));
    }, [nodes, setNodes]);
    const onEdgesChange = useCallback((changes) => {
        setEdges(applyEdgeChanges(changes, edges));
    }, [edges, setEdges]);
    const onConnect = useCallback((connection) => {
        const newEdge = {
            id: `edge-${Date.now()}`,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle || undefined,
            targetHandle: connection.targetHandle || undefined,
            data: {
                dataType: 'unknown',
            },
        };
        addEdge(newEdge);
    }, [addEdge]);
    return (_jsx("div", { style: { width: '100%', height: '100%', background: '#fafafa' }, children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, onConnect: onConnect, nodeTypes: nodeTypes, fitView: true, minZoom: 0.1, maxZoom: 2, children: [_jsx(Background, { variant: BackgroundVariant.Dots, gap: 16, size: 1 }), _jsx(Controls, {}), _jsx(MiniMap, { nodeStrokeWidth: 3, style: {
                        background: '#f0f0f0',
                    } })] }) }));
}
