import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ComfyNodeData, PortDefinition } from '../../../types/graph';

function PortRow({ port, kind }: { port: PortDefinition; kind: 'target' | 'source' }) {
  return (
    <li data-port-type={port.dataType} data-port-side={kind === 'target' ? 'input' : 'output'}>
      <Handle
        type={kind}
        position={kind === 'target' ? Position.Left : Position.Right}
        id={port.id}
        data-port-type={port.dataType}
        style={{ top: '50%' }}
      />
      <span className="port-swatch" aria-hidden="true" />
      <span className="port-name">{port.name}</span>
      {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className="port-type">{port.dataType}</span>}
    </li>
  );
}

export default function ComfyNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as ComfyNodeData;
  const parameters = Object.entries(data.parameters || {});
  const primary = data.outputs[0]?.dataType || data.inputs[0]?.dataType || 'unknown';

  return (
    <div className={`graph-node${selected ? ' is-selected' : ''}${data.locked ? ' is-locked' : ''}`} data-demo={data.demo ? 'true' : 'false'} data-primary-type={primary}>
      {data.demo ? <span className="demo-flag">DEMO</span> : null}
      {data.locked ? <span className="lock-flag">Locked</span> : null}
      <div className="graph-node-title">{data.title || data.comfyType}</div>
      <div className="graph-node-type">{data.comfyType}</div>
      {data.inputs.length > 0 ? (
        <ul className="port-list" aria-label="Inputs">
          {data.inputs.map((port) => (
            <PortRow key={port.id} port={port} kind="target" />
          ))}
        </ul>
      ) : null}
      {data.outputs.length > 0 ? (
        <ul className="port-list" aria-label="Outputs">
          {data.outputs.map((port) => (
            <PortRow key={port.id} port={port} kind="source" />
          ))}
        </ul>
      ) : null}
      {parameters.length > 0 ? (
        <div className="node-params">
          {parameters.slice(0, 3).map(([key, value]) => (
            <div key={key}>
              <span className="param-key">{key}: </span>
              <span>{String(value).length > 24 ? `${String(value).slice(0, 24)}…` : String(value)}</span>
            </div>
          ))}
          {parameters.length > 3 ? <div className="param-key">+{parameters.length - 3} more</div> : null}
        </div>
      ) : null}
      {data.annotations && data.annotations.length > 0 ? (
        <div className="node-annotation">
          <span className="note-label">Note: </span>
          {data.annotations[0]}
        </div>
      ) : null}
    </div>
  );
}
