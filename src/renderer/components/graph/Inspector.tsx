import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGraphStore } from '../../state/graphState';
import { ComfyNodeData } from '../../types/graph';

export default function Inspector() {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const selected = nodes.filter((item) => item.selected);
  const label = String(t('inspector.label'));
  if (selected.length > 1) {
    return (
      <section className="inspector" role="region" aria-label={label}>
        <h2>{t('inspector.multi', { count: selected.length })}</h2>
        <p className="inspector-type">{t('inspector.multiDetail')}</p>
      </section>
    );
  }
  const node = selected[0];
  if (!node) {
    return (
      <section className="inspector" role="region" aria-label={label}>
        <h2>{t('inspector.heading')}</h2>
        <p className="inspector-empty">{t('inspector.empty')}</p>
      </section>
    );
  }
  const data = node.data as ComfyNodeData;
  const parameters = Object.entries(data.parameters || {});
  const ports = [
    ...data.inputs.map((port) => ({ ...port, direction: 'in' })),
    ...data.outputs.map((port) => ({ ...port, direction: 'out' })),
  ];
  return (
    <section className="inspector" role="region" aria-label={label}>
      <h2>{data.title || data.comfyType}</h2>
      <p className="inspector-type">{data.comfyType}</p>
      <h3>{t('inspector.ports')}</h3>
      <div className="inspector-ports">
        {ports.map((port) => (
          <div key={`${port.direction}-${port.id}`} className="inspector-port" data-port-type={port.dataType}>
            <span>{port.direction === 'in' ? t('inspector.in') : t('inspector.out')}</span>
            <span className="port-name">{port.name}</span>
            {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className="port-type">{port.dataType}</span>}
          </div>
        ))}
      </div>
      <h3>{t('inspector.properties')}</h3>
      {parameters.length === 0 ? <p className="inspector-empty">{t('inspector.noParameters')}</p> : (
        <div className="inspector-ports">
          {parameters.map(([key, value]) => (
            <div key={key} className="inspector-port">
              <span className="port-name">{key}</span>
              <span className="port-type">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
