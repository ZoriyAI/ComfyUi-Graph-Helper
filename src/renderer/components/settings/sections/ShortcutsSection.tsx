import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, X } from 'lucide-react';
import { allCommands, defaultShortcutOf, type Command, type CommandGroup } from '../../../commands/registry';
import { chordFromEvent, detectPlatform, formatShortcut, localKeyFor, readLayoutMap, sameChord, type LayoutMap } from '../../../commands/shortcuts';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import IconButton from '../../../ui/IconButton';
import Shortcut from '../../../ui/Shortcut';
import { cx } from '../../../ui/cx';
import styles from '../SettingsPanel.module.css';
import { hintClass, SectionHead, type DraftProps } from './common';

const GROUPS: CommandGroup[] = ['file', 'edit', 'view', 'graph', 'assistant', 'sync', 'help'];

/** Radio choices read as "Motion: On", "Provider: OpenAI" so a row is clear on its own. */
function labelOf(command: Command, t: (key: string) => string): string {
  const label = t(command.labelKey);
  if (command.id.startsWith('view.language.')) return `${t('menu.language')}: ${label}`;
  if (command.id.startsWith('view.motion.')) return `${t('menu.motion')}: ${label}`;
  if (command.id.startsWith('assistant.provider.')) return `${t('menu.provider')}: ${label}`;
  return label;
}

export interface ShortcutRow {
  id: string;
  group: CommandGroup;
  label: string;
  defaultChord: string;
  chord: string;
}

/** Each row's chord after the draft overrides, and which other rows share it. */
export function shortcutConflicts(rows: Array<Pick<ShortcutRow, 'id' | 'chord'>>): Record<string, string[]> {
  const conflicts: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.chord) continue;
    const others = rows.filter((other) => other.id !== row.id && sameChord(other.chord, row.chord)).map((other) => other.id);
    if (others.length > 0) conflicts[row.id] = others;
  }
  return conflicts;
}

/**
 * The overrides after moving `chord` to `id`: every other command that had it loses it (an empty override means
 * "no shortcut"), so two actions never share one shortcut.
 */
export function moveChord(overrides: Record<string, string>, id: string, chord: string, from: string[], defaultOf: (id: string) => string): Record<string, string> {
  const next = { ...overrides };
  for (const other of from) next[other] = '';
  if (chord === defaultOf(id)) delete next[id];
  else next[id] = chord;
  return next;
}

/**
 * Settings ▸ Shortcuts: every command with its shortcut. Change records the next key press (Escape cancels),
 * conflicts are marked on both rows, Reset goes back to the default. Overrides apply after Save.
 */
export default function ShortcutsSection({ prefs, setPrefs }: DraftProps) {
  const { t } = useTranslation();
  const tr = (key: string) => String(t(key));
  const platform = detectPlatform();
  const [recording, setRecording] = useState<string | null>(null);
  // The keyboard layout as it is now, read when the section opens and after each key press (a layout switch).
  const [layout, setLayout] = useState<LayoutMap | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => void readLayoutMap().then((map) => { if (live) setLayout(map); });
    read();
    window.addEventListener('keyup', read);
    return () => {
      live = false;
      window.removeEventListener('keyup', read);
    };
  }, []);
  // A chord another command already has: nothing changes until the person moves it or keeps the old one.
  const [taken, setTaken] = useState<{ id: string; chord: string; others: string[] } | null>(null);
  const overrides = prefs.shortcuts;

  const rows: ShortcutRow[] = useMemo(() => allCommands().map((command) => {
    const defaultChord = defaultShortcutOf(command.id);
    const chord = Object.prototype.hasOwnProperty.call(overrides, command.id) ? overrides[command.id] : defaultChord;
    return { id: command.id, group: command.group, label: labelOf(command, tr), defaultChord, chord };
  }), [overrides, t]);
  const conflicts = shortcutConflicts(rows);
  const labels = Object.fromEntries(rows.map((row) => [row.id, row.label]));

  const setChord = (id: string, chord: string) => {
    setPrefs((current) => {
      const next = { ...current.shortcuts };
      if (chord === defaultShortcutOf(id)) delete next[id];
      else next[id] = chord;
      return { ...current, shortcuts: next };
    });
  };

  useEffect(() => {
    if (!recording) return undefined;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        setRecording(null);
        return;
      }
      const chord = chordFromEvent(event, platform);
      if (!chord) return;
      const others = rows.filter((row) => row.id !== recording && row.chord && sameChord(row.chord, chord)).map((row) => row.id);
      if (others.length > 0) setTaken({ id: recording, chord, others });
      else setChord(recording, chord);
      setRecording(null);
    };
    // Capture on window: the key never reaches the app hotkeys or the dialog's own Escape.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, platform, rows]);

  return (
    <>
      <SectionHead title={String(t('preferences.nav.shortcuts'))} lead={String(t('preferences.lead.shortcuts'))} />
      {taken ? (
        <div className={styles.rowStart} role="alert">
          <span className={hintClass}>
            {t('preferences.chordTaken', { shortcut: formatShortcut(taken.chord, platform), command: taken.others.map((id) => labels[id] ?? id).join(', '), target: labels[taken.id] ?? taken.id })}
          </span>
          <Button size="sm" variant="subtle" onClick={() => {
            setPrefs((current) => ({ ...current, shortcuts: moveChord(current.shortcuts, taken.id, taken.chord, taken.others, defaultShortcutOf) }));
            setTaken(null);
          }}>
            {t('preferences.chordMove')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTaken(null)}>{t('preferences.chordKeep')}</Button>
        </div>
      ) : null}
      <div className={styles.rowStart}>
        <Button size="sm" variant="subtle" icon={<RotateCcw size={14} aria-hidden="true" />} disabled={Object.keys(overrides).length === 0} onClick={() => setPrefs((current) => ({ ...current, shortcuts: {} }))}>
          {t('preferences.resetAll')}
        </Button>
      </div>
      {GROUPS.map((group) => {
        const groupRows = rows.filter((row) => row.group === group);
        if (groupRows.length === 0) return null;
        return (
          <table key={group} className={cx(styles.table, styles.shortcutTable)}>
            <caption className={styles.caption}>{t(`menu.${group}`)}</caption>
            {/* The same columns in every group, so the buttons stand in one line down the whole page. */}
            <colgroup>
              <col />
              <col className={styles.chordCol} />
              <col className={styles.actionsCol} />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">{t('preferences.commandColumn')}</th>
                <th scope="col">{t('preferences.shortcutColumn')}</th>
                <th scope="col">{t('preferences.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((row) => {
                const isRecording = recording === row.id;
                const changed = row.chord !== row.defaultChord;
                const clash = conflicts[row.id];
                return (
                  <tr key={row.id} className={cx(clash && styles.conflictRow)} data-command={row.id} data-recording={isRecording ? 'true' : undefined}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <div className={styles.chordCell}>
                      {isRecording ? (
                        <span className={styles.recording} role="status">{t('preferences.recording')}</span>
                      ) : row.chord ? (
                        <span className={styles.chord}>
                          <Shortcut shortcut={row.chord} platform={platform} />
                          <span className="sr-only">{formatShortcut(row.chord, platform)}</span>
                        </span>
                      ) : (
                        <span className={styles.none}>{t('preferences.noShortcut')}</span>
                      )}
                      {row.chord && !isRecording ? <LocalKey chord={row.chord} layout={layout} /> : null}
                      {changed && !isRecording ? (
                        <span className={styles.defaultNote}>
                          {t('preferences.defaultIs', { shortcut: row.defaultChord ? formatShortcut(row.defaultChord, platform) : t('preferences.noShortcut') })}
                        </span>
                      ) : null}
                      {clash && !isRecording ? (
                        <Badge tone="warn" className={styles.conflictBadge}>
                          {t('preferences.conflict', { command: clash.map((id) => labels[id] ?? id).join(', ') })}
                        </Badge>
                      ) : null}
                      </div>
                    </td>
                    <td className={styles.actionsCell}>
                      <Button
                        size="sm"
                        variant={isRecording ? 'primary' : 'subtle'}
                        aria-label={String(t('preferences.changeLabel', { command: row.label }))}
                        aria-pressed={isRecording}
                        onClick={() => setRecording(isRecording ? null : row.id)}
                      >
                        {isRecording ? t('preferences.recording') : t('preferences.change')}
                      </Button>
                      <IconButton size="sm" label={String(t('preferences.clearLabel', { command: row.label }))} disabled={row.chord === ''} onClick={() => setChord(row.id, '')}>
                        <X size={15} aria-hidden="true" />
                      </IconButton>
                      <IconButton size="sm" label={String(t('preferences.resetLabel', { command: row.label }))} disabled={!changed} onClick={() => setChord(row.id, row.defaultChord)}>
                        <RotateCcw size={14} aria-hidden="true" />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
      {recording ? <p className={hintClass} role="status">{t('preferences.recordingHint', { command: labels[recording] ?? recording })}</p> : null}
    </>
  );
}

/** What to press on this keyboard layout when it is not the key marked with the shortcut's letter or sign. */
function LocalKey({ chord, layout }: { chord: string; layout: LayoutMap | null }) {
  const { t } = useTranslation();
  const local = localKeyFor(chord, layout);
  if (!local) return null;
  return (
    <span className={styles.defaultNote} data-local-key={local.kind}>
      {local.kind === 'key' ? t('preferences.localKey', { key: local.key.toUpperCase() }) : t('preferences.localShift')}
    </span>
  );
}

