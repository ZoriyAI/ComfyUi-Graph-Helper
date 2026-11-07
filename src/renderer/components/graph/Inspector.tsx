import React from 'react';
import { useGraphStore } from '../../state/graphState';
import { ComfyNodeData } from '../../types/graph';

export default function Inspector() {
  const node = useGraphStore((state) => state.nodes.find((item) => item.selected));
  if (!node) {
    return <p className="inspector-empty">No node selected.</p>;
  }
  const data = node.data as ComfyNodeData;
  const ports = [
    ...data.inputs.map((port) => ({ ...port, direction: 'in' })),
    ...data.outputs.map((port) => ({ ...port, direction: 'out' })),
  ];
  return (
    <section className="inspector" role="region" aria-label="Inspector">
      <h2>{data.title || data.comfyType}</h2>
      <p className="inspector-type">{data.comfyType}</p>
      <div className="inspector-ports">
        {ports.map((port) => (
          <div key={`${port.direction}-${port.id}`} className="inspector-port" data-port-type={port.dataType}>
            <span className="port-swatch" aria-hidden="true" />
            <span>{port.direction === 'in' ? 'In' : 'Out'}</span>
            <span className="port-name">{port.name}</span>
            {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className="port-type">{port.dataType}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
