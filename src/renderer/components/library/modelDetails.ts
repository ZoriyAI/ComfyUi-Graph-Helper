import { useEffect, useState } from 'react';
import type { ModelDetail, ModelSummary } from '../../../shared/contracts';
import { modelKey } from './libraryModel';

/** Trigger-word counts are only in the model detail; read them for the rows on screen and keep them. */
const cache = new Map<string, number>();
const inflight = new Set<string>();

export function clearModelDetailCache(): void {
  cache.clear();
}

export function useTriggerCounts(visible: ModelSummary[]): Map<string, number> {
  const [, setTick] = useState(0);
  const keys = visible.map(modelKey).join('\n');
  useEffect(() => {
    let cancelled = false;
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
          if (!cancelled) setTick((value) => value + 1);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [keys]);
  return cache;
}
