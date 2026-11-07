import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ComfyNodeData } from '../../../types/graph';

export default function ComfyNode({ data, selected }: NodeProps<ComfyNodeData>) {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#1a73e8' : '#ccc'}`,
        background: data.locked ? '#f5f5f5' : 'white',
        minWidth: '180px',
        maxWidth: '250px',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {/* Input handles */}
      {data.inputs.map((input, idx) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{
            top: `${40 + idx * 24}px`,
            width: '10px',
            height: '10px',
            background: '#1a73e8',
            border: '2px solid white',
          }}
          title={`${input.name} (${input.dataType})`}
        />
      ))}

      {/* Node header */}
      <div
        style={{
          fontWeight: 600,
          marginBottom: '8px',
          fontSize: '14px',
          color: '#333',
        }}
      >
        {data.title || data.comfyType}
      </div>

      {/* Node type */}
      <div
        style={{
          fontSize: '11px',
          color: '#666',
          marginBottom: '8px',
          fontFamily: 'monospace',
        }}
      >
        {data.comfyType}
      </div>

      {/* Parameters */}
      {Object.keys(data.parameters).length > 0 && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px',
            background: '#f9f9f9',
            borderRadius: '4px',
            fontSize: '11px',
          }}
        >
          {Object.entries(data.parameters)
            .slice(0, 3)
            .map(([key, value]) => (
              <div key={key} style={{ marginBottom: '2px' }}>
                <span style={{ color: '#666' }}>{key}:</span>{' '}
                <span style={{ color: '#333', fontWeight: 500 }}>
                  {String(value).length > 20
                    ? String(value).substring(0, 20) + '...'
                    : String(value)}
                </span>
              </div>
            ))}
          {Object.keys(data.parameters).length > 3 && (
            <div style={{ color: '#999', fontSize: '10px', marginTop: '4px' }}>
              +{Object.keys(data.parameters).length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Annotations */}
      {data.annotations && data.annotations.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px',
            background: '#e3f2fd',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#1976d2',
            borderLeft: '3px solid #1a73e8',
          }}
        >
          💡 {data.annotations[0]}
        </div>
      )}

      {/* Locked indicator */}
      {data.locked && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '12px',
          }}
        >
          🔒
        </div>
      )}

      {/* Output handles */}
      {data.outputs.map((output, idx) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{
            top: `${40 + idx * 24}px`,
            width: '10px',
            height: '10px',
            background: '#1a73e8',
            border: '2px solid white',
          }}
          title={`${output.name} (${output.dataType})`}
        />
      ))}
    </div>
  );
}
