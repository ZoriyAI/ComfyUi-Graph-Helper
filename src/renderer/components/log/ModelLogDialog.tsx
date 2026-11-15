import { modelDisplayName } from '../shell/modelDisplayName';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCopy, FileDown, FolderOpen, ScrollText, Trash2 } from 'lucide-react';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Switch from '../../ui/Switch';
import EmptyState from '../../ui/EmptyState';
import { cx } from '../../ui/cx';
import type { ModelLogList, ModelLogTurn } from '../../../shared/contracts/modelLog';
import { savePreferencesPatch, usePreferencesStore } from '../../state/preferencesState';
import { useModelLogStore } from '../../state/modelLogState';
import { clearModelLog, copyTurnReport, loadModelLog, openModelLogFolder, revealSavedLog, saveModelLog } from '../../services/diagnostics/modelLog';
import { durationParts, formatLogBytes, formatTurnTime, intentLabelKey, outcomeView, pickTurns, providerLabelKey } from './modelLogView';
import styles from './ModelLogDialog.module.css';
import { formatNumber } from '../../../shared/i18n/format';

export interface ModelLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The turn the person came from (an answer in the chat): ticked and scrolled into view. */
  focusTurn?: string | null;
}

type Pick = 'last' | 'today' | 'errors' | 'all' | 'none';

/** What the last action did, said inside the window (a toast behind a modal cannot be clicked or heard). */
interface Notice {
  tone: 'ok' | 'error';
  text: string;
  /** Set after a save: where the file went, with a way to show it. */
  path?: string;
}

function TurnRow({ turn, checked, focused, onToggle, onNotice, language }: {
  turn: ModelLogTurn;
  checked: boolean;
  focused: boolean;
  onToggle: (id: string) => void;
  onNotice: (notice: Notice) => void;
  language: 'en' | 'ru';
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLLIElement>(null);
  const [copying, setCopying] = useState(false);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  const when = formatTurnTime(turn.startedAt, language);
  const time = when.day === 'date' ? when.text : String(t(`modelLog.${when.day}`, { time: when.text }));
  const outcome = outcomeView(turn.outcome);
  const duration = durationParts(turn.durationMs);
  const facts: string[] = [];
  if (turn.steps > 0) facts.push(String(t('modelLog.steps', { count: turn.steps })));
  if (turn.toolCalls > 0) facts.push(String(t('modelLog.toolCalls', { count: turn.toolCalls })));
  if (duration) {
    facts.push(String(duration.minutes > 0
      ? t('modelLog.minutes', { minutes: duration.minutes, seconds: String(duration.seconds).padStart(2, '0') })
      : t('modelLog.seconds', { seconds: formatNumber(duration.seconds, language, { maximumFractionDigits: 1 }) })));
  }
  if (turn.inputTokens != null || turn.outputTokens != null) {
    facts.push(String(t('modelLog.tokens', { input: turn.inputTokens ?? '—', output: turn.outputTokens ?? '—' })));
  }
  const question = turn.question.trim() || String(t('modelLog.noQuestion'));
  // The model as a person names it; the test mode has no model of its own to name.
  const who = [turn.provider === 'test' ? '' : modelDisplayName(turn.model ?? ''), String(t(providerLabelKey(turn.provider)))].filter((part) => part !== '').join(' · ');

  return (
    <li ref={ref} className={cx(styles.turn, checked && styles.turnChecked, 'model-log-turn')} data-outcome={turn.outcome} data-turn={turn.id}>
      <label className={styles.turnMain}>
        <input
          type="checkbox"
          className={styles.check}
          checked={checked}
          onChange={() => onToggle(turn.id)}
          aria-label={String(t('modelLog.pickTurn', { time, question }))}
        />
        <span className={styles.turnText}>
          <span className={styles.turnHead}>
            <span className={styles.time}>{time}</span>
            <Badge tone={outcome.tone} className="model-log-outcome">{t(outcome.labelKey)}</Badge>
            <span className={styles.intent}>{t(intentLabelKey(turn.intent))}</span>
          </span>
          <span className={styles.question}>{question}</span>
          <span className={styles.meta}>{who}{facts.length > 0 ? ` · ${facts.join(', ')}` : ''}</span>
          {turn.error ? <span className={styles.error}>{turn.error}</span> : null}
        </span>
      </label>
      <Button
        variant="subtle"
        size="sm"
        className={styles.copy}
        icon={<ClipboardCopy size={14} />}
        loading={copying}
        title={String(t('modelLog.copyReportHint'))}
        onClick={async () => {
          setCopying(true);
          const result = await copyTurnReport(turn.id);
          setCopying(false);
          onNotice(result.ok
            ? { tone: 'ok', text: `${String(t('modelLog.copied'))}. ${String(t('modelLog.copiedHint'))}` }
            : { tone: 'error', text: result.message });
        }}
      >
        {t('modelLog.copyReport')}
      </Button>
    </li>
  );
}

/**
 * Help ▸ Conversation log: every question to the model with what was sent and what came back, kept on this
 * computer. The person ticks the turns that went wrong and saves them into one file to send to whoever will read
 * it, or copies a short report of one turn straight into a message.
 */
export default function ModelLogDialog({ open, onOpenChange, focusTurn = null }: ModelLogDialogProps) {
  const { t, i18n } = useTranslation();
  const language: 'en' | 'ru' = (i18n.language || 'ru').toLowerCase().startsWith('en') ? 'en' : 'ru';
  const keeping = usePreferencesStore((state) => state.preferences.privacy.modelLog);
  const [list, setList] = useState<ModelLogList | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async (preselect: boolean) => {
    const next = await loadModelLog();
    setList(next);
    setChecked((current) => {
      const known = new Set(next.turns.map((turn) => turn.id));
      if (!preselect) return new Set([...current].filter((id) => known.has(id)));
      // The person opens the log right after an answer went wrong: that answer is already ticked.
      if (focusTurn && known.has(focusTurn)) return new Set([focusTurn]);
      return new Set(pickTurns(next.turns, 'last'));
    });
  }, [focusTurn]);

  useEffect(() => {
    if (!open) return;
    setConfirmClear(false);
    setNotice(null);
    void reload(true);
  }, [open, reload]);

  const turns = list?.turns ?? [];
  const errors = useMemo(() => pickTurns(turns, 'errors').length, [turns]);
  const toggle = useCallback((id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const pick = (choice: Pick) => setChecked(new Set(pickTurns(turns, choice)));

  const save = async () => {
    setSaving(true);
    const result = await saveModelLog({ ids: [...checked] });
    setSaving(false);
    if (result.ok) setNotice({ tone: 'ok', text: String(t('modelLog.saved', { count: result.turns })), path: result.path });
    // Closing the system dialog is a decision, not a failure: nothing to say.
    else if (!result.canceled) setNotice({ tone: 'error', text: `${String(t('modelLog.saveFailed'))}. ${result.message}` });
  };

  const clear = async () => {
    setConfirmClear(false);
    const removed = await clearModelLog();
    setNotice({ tone: 'ok', text: String(t('modelLog.cleared', { count: removed })) });
    await reload(false);
  };

  const openFolder = async () => {
    const result = await openModelLogFolder();
    if (!result.ok) setNotice({ tone: 'error', text: result.message });
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className={cx(styles.dialog, 'model-log-dialog')}
          aria-describedby="model-log-lead"
          onOpenAutoFocus={(event) => {
            // The window opens on the records, not on the switch that turns the log off: the ticked record (the
            // answer it was opened from) or the first one; with none yet, the window itself.
            event.preventDefault();
            const box = event.currentTarget as HTMLElement;
            const target = box.querySelector<HTMLElement>('input[type="checkbox"]:checked') ?? box.querySelector<HTMLElement>('input[type="checkbox"]') ?? box;
            target.focus({ preventScroll: true });
          }}
        >
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('modelLog.title')}</DialogTitle>
            <DialogDescription id="model-log-lead" className={styles.lead}>{t('modelLog.lead')}</DialogDescription>
          </header>

          <div className={styles.bar}>
            <Switch
              label={t('modelLog.keep')}
              checked={keeping}
              onCheckedChange={(next) => void savePreferencesPatch({ privacy: { modelLog: next } })}
            />
            <span className={styles.usage}>
              {list && list.files > 0
                ? t('modelLog.usage', { count: list.files, size: formatLogBytes(list.bytes, language) })
                : null}
            </span>
          </div>
          {!keeping ? <p className={styles.off}>{t('modelLog.offNote')}</p> : null}

          {list && turns.length === 0 ? (
            <EmptyState className={styles.empty} icon={<ScrollText size={22} />} title={String(t('modelLog.emptyTitle'))}>
              {t(keeping ? 'modelLog.emptyBody' : 'modelLog.emptyBodyOff')}
            </EmptyState>
          ) : null}

          {turns.length > 0 ? (
            <>
              <div className={styles.pick} role="group" aria-label={String(t('modelLog.pickLabel'))}>
                <span className={styles.pickLabel}>{t('modelLog.pickLabel')}</span>
                <button type="button" className={styles.pickLink} onClick={() => pick('last')}>{t('modelLog.pick.last')}</button>
                <button type="button" className={styles.pickLink} onClick={() => pick('today')}>{t('modelLog.pick.today')}</button>
                {errors > 0 ? <button type="button" className={styles.pickLink} onClick={() => pick('errors')}>{t('modelLog.pick.errors', { count: errors })}</button> : null}
                <button type="button" className={styles.pickLink} onClick={() => pick('all')}>{t('modelLog.pick.all')}</button>
                {checked.size > 0 ? <button type="button" className={styles.pickLink} onClick={() => pick('none')}>{t('modelLog.pick.none')}</button> : null}
              </div>
              <ul className={styles.list} aria-label={String(t('modelLog.listLabel'))}>
                {turns.map((turn) => (
                  <TurnRow key={turn.id} turn={turn} checked={checked.has(turn.id)} focused={open && turn.id === focusTurn} onToggle={toggle} onNotice={setNotice} language={language} />
                ))}
              </ul>
            </>
          ) : null}

          {notice ? (
            <div className={cx(styles.notice, notice.tone === 'error' && styles.noticeError, 'model-log-notice')} role="status" data-tone={notice.tone}>
              <div className={styles.noticeText}>
                <span>{notice.text}</span>
                {notice.path ? <span className={styles.noticePath}>{t('modelLog.savedHint', { path: notice.path })}</span> : null}
              </div>
              {notice.path ? (
                <Button variant="subtle" size="sm" icon={<FolderOpen size={14} />} onClick={() => void revealSavedLog()}>{t('modelLog.showFile')}</Button>
              ) : null}
            </div>
          ) : null}

          <footer className={styles.footer}>
            {confirmClear ? (
              <div className={styles.confirm} role="alert">
                <span>{t('modelLog.clearConfirm', { count: list?.files ?? 0 })}</span>
                <Button variant="danger" size="sm" onClick={() => void clear()}>{t('modelLog.clearYes')}</Button>
                <Button variant="subtle" size="sm" onClick={() => setConfirmClear(false)}>{t('modelLog.clearNo')}</Button>
              </div>
            ) : (
              <div className={styles.side}>
                <Button variant="subtle" size="sm" icon={<FolderOpen size={14} />} onClick={() => void openFolder()}>{t('modelLog.openFolder')}</Button>
                <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} disabled={!list || list.files === 0} onClick={() => setConfirmClear(true)}>{t('modelLog.clear')}</Button>
              </div>
            )}
            <div className={styles.main}>
              <DialogClose asChild>
                <Button variant="subtle" size="sm">{t('modelLog.close')}</Button>
              </DialogClose>
              <Button
                variant="primary"
                size="sm"
                icon={<FileDown size={14} />}
                disabled={checked.size === 0}
                loading={saving}
                title={checked.size === 0 ? String(t('modelLog.saveNothing')) : undefined}
                onClick={() => void save()}
              >
                {checked.size > 0 ? t('modelLog.save', { count: checked.size }) : t('modelLog.saveEmpty')}
              </Button>
            </div>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/** Mounted once at the app root: the window opens from the Help menu, from an answer in the chat, or by command. */
export function ModelLogHost() {
  const open = useModelLogStore((state) => state.open);
  const focusTurn = useModelLogStore((state) => state.focusTurn);
  const hide = useModelLogStore((state) => state.hide);
  return (
    <ModelLogDialog
      open={open}
      focusTurn={focusTurn}
      onOpenChange={(next) => {
        if (!next) hide();
      }}
    />
  );
}
