import React from 'react';
import { useTranslation } from 'react-i18next';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import Shortcut from '../../ui/Shortcut';
import { cx } from '../../ui/cx';
import { allCommands, type CommandGroup } from '../../commands/registry';
import { exportWorkflowNow, startNewProject } from '../../commands/actions';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useDockStore } from '../../state/dockState';
import { exportGuardFindings } from '../../commands/exportGuard';
import { useUiStore } from '../../state/uiState';
import { version } from '../../../../package.json';
import styles from './CommandDialogs.module.css';

const GROUPS: CommandGroup[] = ['file', 'edit', 'view', 'graph', 'assistant', 'sync', 'help'];

/** Keys that are not commands of their own but people still need to know. */
const EXTRA_KEYS: Array<{ shortcuts: string[]; labelKey: string; group: CommandGroup }> = [
  { shortcuts: ['Alt', 'F10'], labelKey: 'shortcuts.menuBar', group: 'help' },
  { shortcuts: ['Shift+F10'], labelKey: 'shortcuts.contextMenu', group: 'help' },
];

/** Help ▸ Keyboard shortcuts (F1): every command that has a shortcut, by menu. */
function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const commands = allCommands().filter((command) => command.shortcut);
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, styles.wide, 'shortcuts-dialog')} aria-describedby="shortcuts-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('shortcuts.title')}</DialogTitle>
            <DialogDescription id="shortcuts-lead" className={styles.lead}>{t('shortcuts.lead')}</DialogDescription>
          </header>
          <div className={styles.columns}>
            {GROUPS.map((group) => {
              const rows = commands.filter((command) => command.group === group);
              const extra = EXTRA_KEYS.filter((item) => item.group === group);
              if (rows.length === 0 && extra.length === 0) return null;
              return (
                <section key={group} className={styles.section} aria-label={String(t(`menu.${group}`))}>
                  <h3 className={styles.sectionTitle}>{t(`menu.${group}`)}</h3>
                  <dl className={styles.rows}>
                    {rows.map((command) => (
                      <div key={command.id} className={styles.row}>
                        <dt>
                          {t(command.labelKey)}
                          {command.shortcutDisplayOnly ? <span className={styles.note}> · {t('shortcuts.deleteNote')}</span> : null}
                        </dt>
                        <dd><Shortcut shortcut={command.shortcut ?? ''} /></dd>
                      </div>
                    ))}
                    {extra.map((item) => (
                      <div key={item.labelKey} className={styles.row}>
                        <dt>{t(item.labelKey)}</dt>
                        <dd className={styles.keys}>{item.shortcuts.map((shortcut) => <Shortcut key={shortcut} shortcut={shortcut} />)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.close')}</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/** Help ▸ About. */
function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const versions = window.electronAPI?.versions;
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'about-dialog')} aria-describedby="about-lead">
          <header className={styles.header}>
            <span className={styles.mark} aria-hidden="true" />
            <DialogTitle className={styles.title}>{t('shell.title')}</DialogTitle>
            <DialogDescription id="about-lead" className={styles.lead}>{t('menu.aboutLead')}</DialogDescription>
          </header>
          <p className={styles.meta}>
            {t('menu.version', { version })}
            {versions ? ` · Electron ${versions.electron} · Chromium ${versions.chrome}` : ''}
          </p>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.close')}</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/** File ▸ New project with unsaved changes: say what happens before clearing the canvas. */
function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'new-project-dialog')} aria-describedby="new-project-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('menu.newProjectTitle')}</DialogTitle>
            <DialogDescription id="new-project-lead" className={styles.lead}>{t('menu.newProjectBody')}</DialogDescription>
          </header>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.cancel')}</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => void startNewProject()}>{t('menu.newProjectConfirm')}</Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

const GUARD_ROWS = 6;

/** File ▸ Export with check findings: say what is wrong before a broken workflow is written. */
function ExportGuardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const report = useKnowledgeStore((state) => state.check);
  const findings = exportGuardFindings(report);
  const shown = findings.slice(0, GUARD_ROWS);
  const close = () => onOpenChange(false);
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'export-guard-dialog')} aria-describedby="export-guard-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('exportGuard.title', { count: findings.length })}</DialogTitle>
            <DialogDescription id="export-guard-lead" className={styles.lead}>{t('exportGuard.lead')}</DialogDescription>
          </header>
          <ul className={styles.findings}>
            {shown.map((finding) => (
              <li key={finding.key} className={styles.finding}>{t(finding.textKey, finding.values)}</li>
            ))}
            {findings.length > shown.length ? <li className={styles.note}>{t('exportGuard.more', { count: findings.length - shown.length })}</li> : null}
          </ul>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('exportGuard.cancel')}</Button>
            </DialogClose>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                close();
                useDockStore.getState().show('check');
              }}
            >
              {t('exportGuard.openCheck')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                close();
                void exportWorkflowNow();
              }}
            >
              {t('exportGuard.exportAnyway')}
            </Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/** The shell's small dialogs, opened from the menu bar and hotkeys through uiState.dialog. */
export default function CommandDialogs() {
  const dialog = useUiStore((state) => state.dialog);
  const setDialog = useUiStore((state) => state.setDialog);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  return (
    <>
      <ShortcutsDialog open={dialog === 'shortcuts'} onOpenChange={close} />
      <AboutDialog open={dialog === 'about'} onOpenChange={close} />
      <NewProjectDialog open={dialog === 'new-project'} onOpenChange={close} />
      <ExportGuardDialog open={dialog === 'export-guard'} onOpenChange={close} />
    </>
  );
}
