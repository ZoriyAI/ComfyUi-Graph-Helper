import { useEffect } from 'react';
import { create } from 'zustand';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { useKnowledgeStore } from '../../state/knowledgeState';

/**
 * Catalog details by class type, fetched once per class for headers, the inspector and tour text.
 * `null` means the catalog does not know the class (or the bridge is missing); the canvas falls back.
 */
interface NodeInfoState {
  details: Record<string, NodeClassDetail | null>;
  request: (classType: string) => Promise<NodeClassDetail | null>;
}

const inflight = new Map<string, Promise<NodeClassDetail | null>>();

export const useNodeInfoStore = create<NodeInfoState>((set, get) => ({
  details: {},
  request: (classType) => {
    if (classType in get().details) return Promise.resolve(get().details[classType]);
    const running = inflight.get(classType);
    if (running) return running;
    const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined;
    const job = (bridge?.nodeTypeDetail ? bridge.nodeTypeDetail(classType) : Promise.resolve(null))
      .catch(() => null)
      .then((detail) => {
        inflight.delete(classType);
        set((state) => ({ details: { ...state.details, [classType]: detail ?? null } }));
        return detail ?? null;
      });
    inflight.set(classType, job);
    return job;
  },
}));

/**
 * After ComfyUI is read (again), what was asked before is asked again: a class that was unknown, or a name
 * without ports, may now have its inputs and fields. Each answer replaces the old one as it comes, so a node on
 * the canvas never loses its fields in between.
 */
export function refreshNodeInfo(): void {
  const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!bridge?.nodeTypeDetail) return;
  for (const classType of Object.keys(useNodeInfoStore.getState().details)) {
    void bridge.nodeTypeDetail(classType).catch(() => null).then((detail) => {
      useNodeInfoStore.setState((state) => ({ details: { ...state.details, [classType]: detail ?? null } }));
    });
  }
}

let seenStatus = false;
let lastRead: number | null = null;
useKnowledgeStore.subscribe((state) => {
  const status = state.sync;
  if (!status) return;
  if (!seenStatus) {
    // Where things stood when the app opened: nothing was asked before that.
    seenStatus = true;
    lastRead = status.lastSyncAt;
    return;
  }
  if (status.state !== 'idle' || status.lastSyncAt === lastRead) return;
  lastRead = status.lastSyncAt;
  refreshNodeInfo();
});

/** The catalog detail for a class, loading it on first use. */
export function useNodeDetail(classType: string | undefined): NodeClassDetail | null {
  const detail = useNodeInfoStore((state) => (classType ? state.details[classType] ?? null : null));
  const request = useNodeInfoStore((state) => state.request);
  useEffect(() => {
    if (classType) void request(classType);
  }, [classType, request]);
  return detail;
}
