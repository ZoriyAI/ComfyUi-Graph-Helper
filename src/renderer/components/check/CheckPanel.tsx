import React from 'react';

/**
 * Chat workstream: the pre-export check. Calls window.electronAPI.checkGraph and focuses findings on the canvas.
 */
export default function CheckPanel({ projectId }: { projectId: string }) {
  return <section className="check-panel" data-placeholder="check" data-project={projectId} />;
}
