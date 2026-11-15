/**
 * Trigger-word counts for the model rows on screen. ModelLibrary.tsx shows them in each row and clears the cache
 * after a sync. Only the rows on screen are read, since one detail request per file of a large library would be slow.
 */
import { useEffect, useRef, useState } from 'react';
import type { ModelDetail, ModelSummary } from '../../../shared/contracts';
import { modelKey } from './libraryModel';

/** Trigger-word counts are only in the model detail; read them for the rows on screen and keep them. */
const cache = new Map<string, number>();
/** Files whose detail is being read now, so a re-render does not ask twice. */
const inflight = new Set<string>();

/** Forgets every count; ModelLibrary calls it when the catalog changes. */
export function clearModelDetailCache(): void {
  cache.clear();
}

/** The counts known so far by model key; the component re-renders as each one arrives. */
export function useTriggerCounts(visible: ModelSummary[]): Map<string, number> {
  const [, setTick] = useState(0);
  const keys = visible.map(modelKey).join('\n');
  // Alive for the component's whole life, not per effect run: when the rows change while a read is in flight, the
  // next run skips that file as "in flight", so the answer of the earlier run must still re-render.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    for (const model of visible) {
      const key = modelKey(model);
      if (cache.has(key) || inflight.has(key)) continue;
      inflight.add(key);
      window.electronAPI.modelDetail(model.directory, model.name)
        .then((detail: ModelDetail | null) => {
          cache.set(key, detail?.triggerWords.length ?? 0);
        })
        .catch(() => {
          cache.set(key, 0);
        })
        .finally(() => {
          inflight.delete(key);
          if (mounted.current) setTick((value) => value + 1);
        });
    }
  }, [keys]);
  return cache;
}
