/**
 * The history player in the canvas toolbar: a button that opens the replay, then play / pause, a slider over the
 * saved versions, "Return to this version" and close. CanvasToolbar renders it; appCommands.ts runs openReplay for
 * the Graph menu. The version shown is a read-only picture; only "Return to this version" changes the graph.
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Pause, Play, Undo2, X } from 'lucide-react';
import { useProjectionStore } from '../../services/commands/projection';
import { useCanvasStore } from './canvasStore';
import { clampIndex, nextPlayIndex, playStartIndex } from './lib/replay';
import { commitManual } from './commit';
import { showToast } from '../../ui/toastStore';
import { i18n } from '../../i18n';
import { readingPaceMs } from '../../motion/policy';
import styles from './Toolbar.module.css';

/** Opens the replay on the newest revision. Shared by the toolbar's player and the Graph ▸ Replay command. */
export async function openReplay(projectId: string = useProjectionStore.getState().projectId): Promise<void> {
  const bridge = window.electronAPI;
  if (!bridge?.listRevisions) return;
  const revisions = await bridge.listRevisions(projectId).catch(() => []);
  useCanvasStore.getState().setReplay({ revisions, index: Math.max(0, revisions.length - 1), playing: false, snapshot: null, loading: revisions.length > 0 });
}

/**
 * "Return to this version": the replay closes and the shown version becomes the graph again as a new step (a
 * restore-revision commit, undoable like any other); the later versions stay in the history.
 */
export async function restoreReplayedVersion(): Promise<void> {
  const replay = useCanvasStore.getState().replay;
  const row = replay?.revisions[replay.index];
  if (!replay || !row) return;
  useCanvasStore.getState().setReplay(null);
  const result = await commitManual({ type: 'restore-revision', revisionId: row.id }, 'replay-restore') as { status?: string } | null;
  if (result?.status === 'applied') {
    showToast({ id: 'replay-restored', tone: 'success', title: String(i18n.t('canvas.replayRestored', { seq: row.revSeq })), duration: 6000 });
  }
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

  // Loads the snapshot of the version under the slider; a newer pick drops an older answer still on its way.
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
  // Playing steps to the next version once the current one is loaded and has been on screen for a reading pause.
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

  // Escape closes the replay, unless the key was pressed inside a dialog, a menu or a list.
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
  // "Return to this version" is offered below the newest version only: the newest is the graph already.
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
        aria-label={String(t('canvas.replayVersionLabel'))}
        aria-valuetext={`${replay.revisions[replay.index]?.revSeq ?? ''}`}
        onChange={(event) => patchReplay({ index: clampIndex(Number(event.target.value), count), playing: false })}
      />
      <span className={styles.label}>{replay.revisions[replay.index]?.revSeq}</span>
      {replay.index < count - 1 ? (
        <button
          type="button"
          className={styles.button}
          onClick={() => void restoreReplayedVersion()}
          aria-label={String(t('canvas.replayRestore'))}
          title={`${String(t('canvas.replayRestore'))}. ${String(t('canvas.replayRestoreHint'))}`}
          data-replay-restore=""
        >
          <Undo2 size={16} aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" className={styles.button} onClick={() => setReplay(null)} aria-label={String(t('canvas.replayExit'))}><X size={16} aria-hidden="true" /></button>
    </span>
  );
}
