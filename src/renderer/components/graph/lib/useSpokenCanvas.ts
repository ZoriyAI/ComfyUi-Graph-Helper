/**
 * The hook CanvasFlow uses to give React Flow its spoken names: every node gets an `ariaLabel` (lib/spoken.ts)
 * and a translated role description, every link an `ariaLabel` and `focusable` only beside a selection.
 *
 * Why a hook: the names follow the interface language, the catalog's readable class names (which arrive late)
 * and the selection, and must be recomputed only when one of those changes.
 */
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNodeInfoStore } from '../nodeInfo';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { classPresence } from '../../../../shared/workflow/comfyLook';
import { edgeFocusable, edgeSpeech, linkedInputCounts, nodeSpeech, spokenTitle, type Say, type SpokenEdgeInput, type SpokenNodeInput } from './spoken';

type FlowNode = SpokenNodeInput & { domAttributes?: Record<string, unknown>; ariaLabel?: string; position: unknown };
type FlowEdge = SpokenEdgeInput & { ariaLabel?: string; focusable?: boolean };

export function useSpokenCanvas<N extends FlowNode, E extends FlowEdge>(nodes: N[], edges: E[], errorNodes: Set<string>): { nodes: N[]; edges: E[] } {
  const { t, i18n } = useTranslation();
  const details = useNodeInfoStore((state) => state.details);
  const catalogRead = useKnowledgeStore((state) => (state.sync?.counts.nodeClasses ?? 0) > 0);
  // The React Flow credit stays visible but leaves the Tab order and the reading order: an English link to a web
  // site was a Tab stop between the canvas and the right panel (the library is credited in About).
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.react-flow__attribution a').forEach((link) => {
      link.tabIndex = -1;
      link.setAttribute('aria-hidden', 'true');
    });
  });
  return useMemo(() => {
    const say: Say = (key, values) => String(values ? t(key, values) : t(key));
    const linked = linkedInputCounts(edges);
    const titles = new Map<string, string>();
    const byId = new Map<string, SpokenNodeInput>();
    const selected = new Set<string>();
    const named = nodes.map((node) => {
      const classType = String((node.data as { comfyType?: unknown }).comfyType ?? '');
      const detail = classType && classType in details ? details[classType] : undefined;
      const instance = (node.data as { kind?: unknown }).kind === 'subgraph-instance';
      titles.set(node.id, spokenTitle(node, detail?.displayName));
      byId.set(node.id, node);
      if (node.selected) selected.add(node.id);
      const ariaLabel = nodeSpeech(node, say, {
        classTitle: detail?.displayName,
        presence: node.type === 'boundary' ? 'known' : classPresence(classType, detail, catalogRead, instance),
        linkedInputs: linked.get(node.id) ?? 0,
        error: errorNodes.has(node.id),
      });
      // React Flow writes aria-roledescription="node" in English; the attribute here comes after it and wins.
      return { ...node, ariaLabel, domAttributes: { ...(node.domAttributes ?? {}), 'aria-roledescription': say('a11y.nodeRole') } };
    });
    const spokenEdges = edges.map((edge) => ({
      ...edge,
      ariaLabel: edgeSpeech(edge, byId, say, titles),
      focusable: edgeFocusable(edge, selected),
      domAttributes: { ...((edge as { domAttributes?: Record<string, unknown> }).domAttributes ?? {}), 'aria-roledescription': say('a11y.edgeRole') },
    }));
    return { nodes: named as N[], edges: spokenEdges as E[] };
    // i18n.language: the names are rebuilt in the new language at once.
  }, [nodes, edges, errorNodes, details, catalogRead, t, i18n.language]);
}
