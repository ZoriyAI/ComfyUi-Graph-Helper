import { useEffect } from 'react';
import { create } from 'zustand';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';

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

/** The catalog detail for a class, loading it on first use. */
export function useNodeDetail(classType: string | undefined): NodeClassDetail | null {
  const detail = useNodeInfoStore((state) => (classType ? state.details[classType] ?? null : null));
  const request = useNodeInfoStore((state) => state.request);
  useEffect(() => {
    if (classType) void request(classType);
  }, [classType, request]);
  return detail;
}
