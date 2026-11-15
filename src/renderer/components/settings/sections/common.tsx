import React from 'react';
import type { NonSecretSettings } from '../../../../shared/config/schema';
import type { Preferences } from '../../../../shared/config/preferences';
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
  container: HTMLElement | null;
  /** aria-invalid / aria-describedby for a field whose value carries a secret. */
  fieldError: (name: string) => Record<string, string | boolean>;
  pending: boolean;
  /** True while the draft differs from what is stored. */
  dirty: boolean;
}

export function patchSection<K extends FlatSection>(setPrefs: DraftProps['setPrefs'], section: K, patch: Partial<Preferences[K]>): void {
  setPrefs((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
}

/** Legacy global classes stay on settings fields; e2e tests and the Escape handling look for them. */
export const fieldClass = cx(styles.field, 'field');
export const hintClass = cx(styles.hint, 'field-hint');
export const rowClass = cx(styles.buttons, 'settings-buttons');

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
