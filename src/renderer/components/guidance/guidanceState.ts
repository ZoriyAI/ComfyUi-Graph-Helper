/** A resumable local guide. Opening a tool never discards the person's place in the instructions. */
import { create } from 'zustand';
import type { ObjectRef } from '../../../shared/contracts/objects';
import type { GuideCategory } from '../../../shared/guidance/catalog';
import { captureEditOrigin, originIsCurrent, type EditOrigin } from '../graph/lib/editOrigin';
import { useGraphStore } from '../../state/graphState';

export interface GuideRequest {
  problemId: string;
  step: number;
  query: string;
  category: GuideCategory | '';
  objectRef?: ObjectRef;
  origin: EditOrigin;
}
interface GuidanceState {
  open: boolean;
  request: GuideRequest | null;
  update: (patch: Partial<Pick<GuideRequest, 'problemId' | 'step' | 'query' | 'category'>>) => void;
  close: () => void;
}
export const useGuidanceStore = create<GuidanceState>((set) => ({
  open: false, request: null,
  update: (patch) => set((state) => ({ request: state.request ? { ...state.request, ...patch } : null })),
  close: () => set({ open: false }),
}));

export function openGuidance(objectRef?: ObjectRef, problemId = ''): void {
  useGuidanceStore.setState({ open: true, request: { problemId, step: 0, query: '', category: '', objectRef, origin: captureEditOrigin() } });
}
export function resumeGuidance(): void {
  if (useGuidanceStore.getState().request) useGuidanceStore.setState({ open: true });
  else openGuidance();
}

/** A repeated node id in another graph must never inherit the previous guide's agent request. */
export function guideObjectIsCurrent(request: GuideRequest): boolean {
  const ref = request.objectRef;
  if (!ref) return true;
  if (!originIsCurrent(request.origin)) return false;
  const graph = useGraphStore.getState();
  const nodes = request.origin.definitionId ? graph.subgraphs.find((d) => d.id === request.origin.definitionId)?.nodes ?? [] : graph.nodes;
  return nodes.some((node) => node.id === ref.id && (!ref.classType || node.data.comfyType === ref.classType));
}
