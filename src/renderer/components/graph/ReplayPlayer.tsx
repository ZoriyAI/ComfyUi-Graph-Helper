import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Pause, Play, X } from 'lucide-react';
import { useProjectionStore } from '../../services/commands/projection';
import { useCanvasStore } from './canvasStore';
import { clampIndex, nextPlayIndex, playStartIndex } from './lib/replay';
import { readingPaceMs } from './lib/motion';
import styles from './Toolbar.module.css';

/** Opens the replay on the newest revision. Shared by the canvas toolbar and the Graph ▸ Replay command. */
export async function openReplay(projectId: string = useProjectionStore.getState().projectId): Promise<void> {
  const bridge = window.electronAPI;
  if (!bridge?.listRevisions) return;
  const revisions = await bridge.listRevisions(projectId).catch(() => []);
  useCanvasStore.getState().setReplay({ revisions, index: Math.max(0, revisions.length - 1), playing: false, snapshot: null, loading: revisions.length > 0 });
}

/**
 * Replay of how the graph grew: a slider over the revision history. The chosen revision is drawn as a
 * read-only overlay (CanvasFlow swaps in its snapshot and blocks commits); the current revision never changes.
 */
export default function ReplayPlayer() {
  const { t } = useTranslation();
  const replay = useCanvasStore((state) => state.replay);
  const setReplay = useCanvasStore((state) => state.setReplay);
  const patchReplay = useCanvasStore((state) => state.patchReplay);
  const projectId = useProjectionStore((state) => state.projectId);

  const open = () => openReplay(projectId);

  const revisionId = replay ? replay.revisions[replay.index]?.id : undefined;
  useEffect(() => {
    if (!revisionId) return undefined;
    let live = true;
    patchReplay({ loading: true });
    void window.electronAPI.loadRevision(projectId, revisionId)
      .catch(() => null)
      .then((snapshot) => {
        if (live) patchReplay({ snapshot, loading: false });
      });
    return () => {
      live = false;
    };
  }, [revisionId, projectId, patchReplay]);

  const playing = replay?.playing ?? false;
  const index = replay?.index ?? 0;
  const loading = replay?.loading ?? true;
  useEffect(() => {
    if (!playing || loading) return undefined;
    const timer = window.setTimeout(() => {
      const current = useCanvasStore.getState().replay;
      if (!current) return;
      const next = nextPlayIndex({ index: current.index, count: current.revisions.length });
      patchReplay(next === null ? { playing: false } : { index: next });
    }, readingPaceMs());
    return () => window.clearTimeout(timer);
  }, [playing, index, loading, patchReplay]);

  const active = Boolean(replay);
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      setReplay(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, setReplay]);

  if (!replay) {
    return (
      <button type="button" className={styles.button} onClick={() => void open()} title={String(t('canvas.replay'))} aria-label={String(t('canvas.replay'))}>
        <History size={16} aria-hidden="true" />
      </button>
    );
  }
  const count = replay.revisions.length;
  if (count === 0) {
    return (
      <span className={styles.group}>
        <span className={styles.label}>{t('canvas.replayEmpty')}</span>
        <button type="button" className={styles.button} onClick={() => setReplay(null)} aria-label={String(t('canvas.replayExit'))}><X size={16} aria-hidden="true" /></button>
      </span>
    );
  }
  return (
    <span className={styles.group} data-replay="on">
      <button
        type="button"
        className={styles.button}
        onClick={() => patchReplay(replay.playing ? { playing: false } : { playing: true, index: playStartIndex({ index: replay.index, count }) })}
        aria-label={String(replay.playing ? t('canvas.pause') : t('canvas.play'))}
      >
        {replay.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={count - 1}
        step={1}
        value={replay.index}
        aria-label={String(t('canvas.replayLabel'))}
        aria-valuetext={`${replay.revisions[replay.index]?.revSeq ?? ''}`}
        onChange={(event) => patchReplay({ index: clampIndex(Number(event.target.value), count), playing: false })}
      />
      <span className={styles.label}>{replay.revisions[replay.index]?.revSeq}</span>
      <button type="button" className={styles.button} onClick={() => setReplay(null)} aria-label={String(t('canvas.replayExit'))}><X size={16} aria-hidden="true" /></button>
    </span>
  );
}
