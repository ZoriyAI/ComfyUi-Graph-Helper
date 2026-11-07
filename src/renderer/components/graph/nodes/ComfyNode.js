import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Handle, Position } from '@xyflow/react';
export default function ComfyNode({ data: rawData, selected }) {
    const data = rawData;
    return (_jsxs("div", { style: {
            padding: '12px',
            borderRadius: '8px',
            border: `2px solid ${selected ? '#1a73e8' : '#ccc'}`,
            background: data.locked ? '#f5f5f5' : 'white',
            minWidth: '180px',
            maxWidth: '250px',
            boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)',
        }, children: [data.inputs.map((input, idx) => (_jsx(Handle, { type: "target", position: Position.Left, id: input.id, style: {
                    top: `${40 + idx * 24}px`,
                    width: '10px',
                    height: '10px',
                    background: '#1a73e8',
                    border: '2px solid white',
                }, title: `${input.name} (${input.dataType})` }, input.id))), _jsx("div", { style: { fontWeight: 600, marginBottom: '8px', fontSize: '14px', color: '#333' }, children: data.title || data.comfyType }), _jsx("div", { style: { fontSize: '11px', color: '#666', marginBottom: '8px', fontFamily: 'monospace' }, children: data.comfyType }), Object.keys(data.parameters).length > 0 && (_jsxs("div", { style: { marginTop: '8px', padding: '6px', background: '#f9f9f9', borderRadius: '4px', fontSize: '11px' }, children: [Object.entries(data.parameters)
                        .slice(0, 3)
                        .map(([key, value]) => (_jsxs("div", { style: { marginBottom: '2px' }, children: [_jsxs("span", { style: { color: '#666' }, children: [key, ":"] }), ' ', _jsx("span", { style: { color: '#333', fontWeight: 500 }, children: String(value).length > 20 ? String(value).substring(0, 20) + '...' : String(value) })] }, key))), Object.keys(data.parameters).length > 3 && (_jsxs("div", { style: { color: '#999', fontSize: '10px', marginTop: '4px' }, children: ["+", Object.keys(data.parameters).length - 3, " more"] }))] })), data.annotations && data.annotations.length > 0 && (_jsxs("div", { style: {
                    marginTop: '8px',
                    padding: '6px',
                    background: '#e3f2fd',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#1976d2',
                    borderLeft: '3px solid #1a73e8',
                }, children: ["\uD83D\uDCA1 ", data.annotations[0]] })), data.locked && (_jsx("div", { style: { position: 'absolute', top: '8px', right: '8px', fontSize: '12px' }, children: "\uD83D\uDD12" })), data.outputs.map((output, idx) => (_jsx(Handle, { type: "source", position: Position.Right, id: output.id, style: {
                    top: `${40 + idx * 24}px`,
                    width: '10px',
                    height: '10px',
                    background: '#1a73e8',
                    border: '2px solid white',
                }, title: `${output.name} (${output.dataType})` }, output.id)))] }));
}
