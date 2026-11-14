import { create } from 'zustand';
import { useChatStore } from '../state/chatState';
import { useProjectionStore } from '../services/commands/projection';
import { getChatService } from '../services/llm/chatService';

/**
 * Open, New and Import while the assistant is building (P0 from the bug bash): the person is asked «Помощник ещё
 * строит. Остановить?» first, the run is stopped, then the action goes on. The engine also stops any open run when
 * another graph takes the canvas, so a step can never land on a graph the run did not start on.
 */
interface BuildGuardState {
  /** The action waiting for the person's answer; null when nothing waits. */
  pending: (() => unknown) | null;
  ask: (action: () => unknown) => void;
  clear: () => void;
}

export const useBuildGuardStore = create<BuildGuardState>((set) => ({
  pending: null,
  ask: (action) => set({ pending: action }),
  clear: () => set({ pending: null }),
}));

/** True while a turn streams or a run is open (running, or paused by the person or at a checkpoint). */
export function assistantBuilding(): boolean {
  if (useChatStore.getState().isStreaming) return true;
  const run = useProjectionStore.getState().activeRun;
  return Boolean(run && (run.status === 'running' || run.status === 'paused'));
}

/** Runs `action` at once, or after the person agreed to stop the assistant's build. */
export function guardBuild(action: () => unknown): () => void {
  return () => {
    if (!assistantBuilding()) {
      void action();
      return;
    }
    useBuildGuardStore.getState().ask(action);
  };
}

/** The person agreed: stop the run (the stream and the run), then do what they asked for. */
export async function stopBuildAndGo(): Promise<void> {
  const action = useBuildGuardStore.getState().pending;
  useBuildGuardStore.getState().clear();
  await getChatService().cancelAndWait();
  if (action) await action();
}
