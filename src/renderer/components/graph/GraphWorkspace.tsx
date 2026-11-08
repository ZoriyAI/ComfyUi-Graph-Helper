import React from 'react';
import GraphCanvas from './GraphCanvas';

/**
 * Canvas workstream: the whole graph area. Wraps React Flow with the floating toolbar, subgraph breadcrumb,
 * ghost layer, flow pulses, tour callouts, context menu and library drop handling.
 * The shell renders it once and passes nothing; state flows through the stores
 * (graphState, proposalsState, uiState) and questions go out through services/ask.ts.
 */
export default function GraphWorkspace() {
  return <GraphCanvas />;
}
