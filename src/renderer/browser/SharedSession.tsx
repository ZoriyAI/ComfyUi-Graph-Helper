/** Shared-project refresh and browser connectivity. Event reconnects read state without replaying commands. */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { applyProjection, useProjectionStore } from '../services/commands/projection';
import { useChatStore } from '../state/chatState';
import { messageFromChatRecord } from '../services/llm/chatModel';
import { useKnowledgeStore } from '../state/knowledgeState';
import { BROWSER_CONNECTION, isBrowserClient } from './bridge';
import { refreshUndoHistory } from '../commands/undo';
import Button from '../ui/Button';
import styles from './Browser.module.css';

/** Subscribe on both transports; only a different head or run replaces the displayed projection. */
export function installSharedSession(): () => void {
  let disposed = false; let running = false; let again = false; let needsKnowledge = false;
  const refresh = async (knowledge = false) => {
    needsKnowledge ||= knowledge;
    if (running) { again = true; return; }
    running = true;
    try {
      do {
        again = false;
        const reloadKnowledge = needsKnowledge; needsKnowledge = false;
        const projection = await window.electronAPI.readProjection(DESKTOP_PROJECT_ID);
        if (disposed) return;
        const shown = useProjectionStore.getState();
        if (projection && (projection.currentRevisionId !== shown.currentRevisionId || JSON.stringify(projection.activeRun) !== JSON.stringify(shown.activeRun))) applyProjection(projection);
        const records = await window.electronAPI.loadChatHistory(DESKTOP_PROJECT_ID, { limit: 100 });
        if (!disposed && Array.isArray(records) && !useChatStore.getState().isStreaming) {
          const incoming = new Map(records.map((record) => [record.id, messageFromChatRecord(record)]));
          useChatStore.setState((state) => {
            const known = new Set(state.messages.map((message) => message.id));
            const messages = state.messages.map((message) => incoming.get(message.id) ?? message);
            for (const [id, message] of incoming) if (!known.has(id)) messages.push(message);
            return { messages: messages.sort((a, b) => a.timestamp - b.timestamp) };
          });
        }
        if (!disposed && reloadKnowledge) void useKnowledgeStore.getState().reloadExplanations().catch(() => undefined);
      } while (again && !disposed);
    } catch { /* The connection banner reports outages; no write is retried. */ }
    finally { running = false; }
  };
  const off = window.electronAPI.onBrowserRefresh?.((notice) => {
    if (notice?.historyChanged) void refreshUndoHistory();
    void refresh(notice?.knowledgeChanged);
  });
  return () => { disposed = true; off?.(); };
}
/** A visible reconnect action retains drafts until the user chooses to reload. */
export default function BrowserConnection() {
  const { t } = useTranslation(); const [state, setState] = useState('online');
  useEffect(() => { const changed = (event: Event) => setState((event as CustomEvent<string>).detail); window.addEventListener(BROWSER_CONNECTION, changed); return () => window.removeEventListener(BROWSER_CONNECTION, changed); }, []);
  if (!isBrowserClient() || state === 'online') return null;
  return <div className={styles.connection} role="status"><span>{t(state === 'unpaired' ? 'browser.pairRequired' : 'browser.disconnected')}</span><Button onClick={() => location.reload()}>{t('browser.reconnect')}</Button></div>;
}
