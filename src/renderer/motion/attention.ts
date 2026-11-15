/**
 * Teaching marks on the canvas: what just changed flashes, and what the lesson is about stands out while the rest
 * steps back.
 *
 * Who uses it:
 * - flash(): a lesson step that was just passed (its new node, link or field), "Show me where" and a check
 *   finding's "Show" button (the node the camera arrived at), an accepted draft (the node it became), the live build
 *   (layers/BuildLayer.tsx) and the history replay (lib/replayMotion.ts). NodeCard and TypedEdge draw the flash; it holds for --motion-mark (a reading time, the same at every motion
 *   level). With full motion it is a ring that glows and fades; with Reduced it fades only; with Off it is a still
 *   ring that is simply removed.
 * - setLessonFocus(): the nodes the current lesson step is about. CanvasFlow dims every other node and link, as it
 *   does around the tour's step.
 *
 * - flashWave() and checkedNodeIds(): the wave over a graph check's findings (components/graph/lib/checkWave.ts).
 *
 * Why a store of its own: these marks come from places that do not render the canvas (the lesson panel, the
 * check panel, the chat), and only the node or link that is marked re-renders.
 */
import { create } from 'zustand';
import { tokenMs } from './policy';

interface AttentionState {
  /** `node:<id>` or `edge:<id>` → a counter, so a second flash of the same thing starts its animation again. */
  flashes: Record<string, number>;
  /** Node ids the open lesson step is about; null when no lesson asks for attention. */
  lessonFocus: string[] | null;
  setLessonFocus: (ids: string[] | null) => void;
}

/** The flashes on screen and the lesson focus; read by NodeCard, TypedEdge and CanvasFlow. */
export const useAttentionStore = create<AttentionState>((set) => ({
  flashes: {},
  lessonFocus: null,
  setLessonFocus: (ids) => set((state) => {
    const same = state.lessonFocus === ids || (state.lessonFocus && ids && state.lessonFocus.length === ids.length && state.lessonFocus.every((id, index) => id === ids[index]));
    return same ? state : { lessonFocus: ids };
  }),
}));

/** Grows with every flash; a timer removes only the marks its own flash set, not a newer flash of the same thing. */
let counter = 0;

/** Flashes nodes and links for the mark's reading time. */
export function flash(items: { nodes?: readonly string[]; edges?: readonly string[] }): void {
  const keys = [...(items.nodes ?? []).map((id) => `node:${id}`), ...(items.edges ?? []).map((id) => `edge:${id}`)];
  if (keys.length === 0) return;
  counter += 1;
  const mine = counter;
  useAttentionStore.setState((state) => ({ flashes: { ...state.flashes, ...Object.fromEntries(keys.map((key) => [key, mine])) } }));
  window.setTimeout(() => {
    useAttentionStore.setState((state) => {
      const next = { ...state.flashes };
      for (const key of keys) if (next[key] === mine) delete next[key];
      return { flashes: next };
    });
  }, tokenMs('--motion-mark'));
}

/**
 * The flash of one node or link for its `data-flash` attribute: "a" or "b" alternate between two flashes so the
 * CSS animation starts again; undefined when nothing flashes.
 */
export function useFlash(key: string): 'a' | 'b' | undefined {
  const value = useAttentionStore((state) => state.flashes[key]);
  return value === undefined ? undefined : value % 2 === 0 ? 'a' : 'b';
}

/** Between two nodes of a wave, and the longest a whole wave may take to start its last flash. */
const WAVE_STEP_MS = 45;
const WAVE_MAX_MS = 900;

/**
 * Flashes nodes one after another from left to right: a wave over what a graph check marked, so a person sees at
 * once how many places it found and where they are. With motion reduced or off every node rings at the same time.
 */
export function flashWave(nodes: ReadonlyArray<{ id: string; x: number }>, full: boolean): void {
  const ordered = [...nodes].sort((a, b) => a.x - b.x);
  if (!full || ordered.length <= 1) {
    flash({ nodes: ordered.map((node) => node.id) });
    return;
  }
  const step = Math.min(WAVE_STEP_MS, WAVE_MAX_MS / ordered.length);
  ordered.forEach((node, index) => window.setTimeout(() => flash({ nodes: [node.id] }), Math.round(index * step)));
}

/** The node ids a graph check marked on the main canvas (each once). */
export function checkedNodeIds(report: {
  missingNodes: Array<{ subgraphId?: string; nodeId: string }>;
  missingModels: Array<{ subgraphId?: string; nodeId: string }>;
  baseModelMismatches: Array<{ subgraphId?: string; nodeId: string }>;
  unconnectedRequiredInputs: Array<{ subgraphId?: string; nodeId: string }>;
  unsetWidgets?: Array<{ subgraphId?: string; nodeId: string }>;
  cycles?: Array<{ subgraphId?: string; nodeIds: string[] }>;
}): string[] {
  const root = (item: { subgraphId?: string }) => !item.subgraphId;
  const ids = [
    ...report.missingNodes.filter(root).map((item) => item.nodeId),
    ...report.missingModels.filter(root).map((item) => item.nodeId),
    ...report.baseModelMismatches.filter(root).map((item) => item.nodeId),
    ...report.unconnectedRequiredInputs.filter(root).map((item) => item.nodeId),
    ...(report.unsetWidgets ?? []).filter(root).map((item) => item.nodeId),
    ...(report.cycles ?? []).filter(root).flatMap((item) => item.nodeIds),
  ];
  return [...new Set(ids)];
}
