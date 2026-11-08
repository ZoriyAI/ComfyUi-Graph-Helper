import React from 'react';
import { useGraphStore } from '../../state/graphState';
import { ComfyNodeData } from '../../types/graph';

export default function Inspector() {
  const nodes = useGraphStore((state) => state.nodes);
  const selected = nodes.filter((item) => item.selected);
  if (selected.length > 1) {
    return (
      <section className="inspector" role="region" aria-label="Inspector">
        <h2>{selected.length} nodes selected</h2>
        <p className="inspector-type">Shared edits are not available. Select one node to see its ports.</p>
      </section>
    );
  }
  const node = selected[0];
  if (!node) {
    return (
      <section className="inspector" role="region" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="inspector-empty">Select a node to see its ports and parameters.</p>
      </section>
    );
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
            <span>{port.direction === 'in' ? 'In' : 'Out'}</span>
            <span className="port-name">{port.name}</span>
            {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className="port-type">{port.dataType}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
