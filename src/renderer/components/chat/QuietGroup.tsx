/**
 * The quiet line of a chat message: everything the helper only read (graph, catalog, models, web), folded into one
 * line. Message.tsx renders it for the "quiet" segment that buildSteps.groupToolCalls makes.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Eye } from 'lucide-react';
import type { ToolCall } from '../../types/chat';
import { quietSentence, stepError, type Translate } from './buildSteps';
import { useStepNames } from './stepNames';
import styles from './QuietGroup.module.css';

/**
 * What the helper only looked at (graph, catalog, models, web) in one message, as one quiet line: the title
 * (chat.quietTitle), the count, then the phrases joined by commas. It opens to one phrase per look.
 * None of it changed anything, so it never competes with the build card or the answer.
 */
export default function QuietGroup({ calls }: { calls: ToolCall[] }) {
  const { t } = useTranslation();
  const translate: Translate = (key, options) => String(options ? t(key, options) : t(key));
  const names = useStepNames();
  const [open, setOpen] = useState(false);
  const phrases = calls.map((call) => quietSentence(call, translate, names));
  const busy = calls.some((call) => call.status === 'pending');
  return (
    <div className={styles.group} data-quiet-group data-busy={busy ? 'true' : undefined}>
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronRight className={styles.chevron} size={13} aria-hidden="true" />
        <Eye className={styles.icon} size={13} aria-hidden="true" />
        <span className={styles.title}>{t('chat.quietTitle')} · {calls.length}</span>
        {open ? null : <span className={styles.preview}>{phrases.join(', ')}</span>}
      </button>
      {open ? (
        <ul className={styles.list}>
          {calls.map((call, index) => {
            const error = stepError(call, translate);
            return (
              <li key={call.id} data-tool-name={call.toolName} data-tool-status={call.status} data-tool-kind={call.kind}>
                <span>{phrases[index]}</span>
                {error ? <span className={styles.failed}> — {t('chat.quietFailed')}: {error.summary}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
