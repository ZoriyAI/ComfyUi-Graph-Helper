/**
 * What every Settings section shares: the DraftProps that SettingsPanel passes to each of them, the helper that
 * patches one preferences section, the field, hint and row classes, and the section and group headings. Keeping them
 * here lets all sections of ./ and SyncSection.tsx line up the same way.
 */
import React from 'react';
import type { NonSecretSettings } from '../../../../shared/config/schema';
import type { Preferences } from '../../../../shared/config/preferences';
import { explainError, type Translator } from '../../../../shared/i18n';
import { cx } from '../../../ui/cx';
import styles from '../SettingsPanel.module.css';

/** Sections whose fields are a flat object (everything except providers and shortcuts). */
export type FlatSection = 'assistant' | 'sync' | 'canvas' | 'appearance' | 'privacy' | 'network';

/** What every section edits: the draft row and the draft preferences. Nothing is written until Save. */
export interface DraftProps {
  values: NonSecretSettings;
  setValues: React.Dispatch<React.SetStateAction<NonSecretSettings>>;
  /** What is stored now (the draft starts from it); a section can tell a saved value from a drafted one. */
  saved: NonSecretSettings;
  prefs: Preferences;
  setPrefs: React.Dispatch<React.SetStateAction<Preferences>>;
  /** The dialog element; popups (selects) portal into it so they stay inside the modal's focus trap. */
  container: HTMLElement | null;
  /** aria-invalid / aria-describedby for a field that keeps the draft from saving (it names the footer's error). */
  fieldError: (name: string) => Record<string, string | boolean>;
  /** True while a save is in flight. */
  pending: boolean;
  /** True while the draft differs from what is stored. */
  dirty: boolean;
}

/**
 * The translated sentence for a call to main that threw (not a result main sent back). Sections use it in their
 * catch blocks so a failed call ends in a readable failure line, never in a state that waits forever.
 */
export function errorSummary(translate: Translator, error: unknown): string {
  return explainError(translate, error instanceof Error ? error.message : String(error)).summary;
}

/** Merges `patch` into one flat preferences section of the draft. */
export function patchSection<K extends FlatSection>(setPrefs: DraftProps['setPrefs'], section: K, patch: Partial<Preferences[K]>): void {
  setPrefs((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
}

/** Legacy global classes stay on settings fields; e2e tests and the Escape handling look for them. */
export const fieldClass = cx(styles.field, 'field');
export const hintClass = cx(styles.hint, 'field-hint');
export const rowClass = cx(styles.buttons, 'settings-buttons');

/** The heading of a section with an optional lead sentence under it. */
export function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className={styles.sectionHead}>
      <h3>{title}</h3>
      {lead ? <p className={hintClass}>{lead}</p> : null}
    </header>
  );
}

/** A titled block of related fields inside a section. */
export function Group({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx(styles.group, className)} aria-label={title}>
      {title ? <h4 className={styles.groupTitle}>{title}</h4> : null}
      {children}
    </section>
  );
}
