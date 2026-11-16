/**
 * The small dialogs of the main window, all mounted at once by App.tsx and opened through uiState.dialog: keyboard
 * shortcuts, About, Help, report a problem, the "replace the graph?" question, and the export guard. Two more open
 * from their own stores: the secret guard (commands/secretGuard) and the stop-the-build guard (commands/buildGuard).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import Shortcut from '../../ui/Shortcut';
import { cx } from '../../ui/cx';
import { allCommands, type CommandGroup } from '../../commands/registry';
import { exportWorkflowNow, importWorkflowNow, openProjectNow, runQueuedOpen, saveProjectFile, startNewProject } from '../../commands/actions';
import { secretFieldLabel, useSecretGuardStore } from '../../commands/secretGuard';
import { stopBuildAndGo, useBuildGuardStore } from '../../commands/buildGuard';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useDockStore } from '../../state/dockState';
import { exportGuardFindings } from '../../commands/exportGuard';
import { nameFindingValues, nodeNamer } from '../check/checkModel';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import AboutContent from './AboutContent';
import HelpReader from './HelpReader';
import SyncProblemsDialog from '../sync/SyncProblemsDialog';
import SubgraphWizard from '../graph/SubgraphWizard';
import GuidanceWizard from '../guidance/GuidanceWizard';
import { showToast } from '../../ui/Toast';
import styles from './CommandDialogs.module.css';

/** The menus in menu-bar order; the shortcuts dialog lists its sections in this order. */
const GROUPS: CommandGroup[] = ['file', 'edit', 'view', 'graph', 'assistant', 'sync', 'help'];

/** Keys that are not commands of their own but people still need to know. */
const EXTRA_KEYS: Array<{ shortcuts: string[]; labelKey: string; group: CommandGroup }> = [
  { shortcuts: ['Alt', 'F10'], labelKey: 'shortcuts.menuBar', group: 'help' },
  { shortcuts: ['Shift+F10'], labelKey: 'shortcuts.contextMenu', group: 'help' },
  // Accessibility: the keyboard routes a person can rely on, which are not commands of their own.
  { shortcuts: ['F6', 'Shift+F6'], labelKey: 'a11y.keysRegions', group: 'help' },
  { shortcuts: ['F8'], labelKey: 'a11y.keysNotifications', group: 'help' },
  { shortcuts: ['Enter', 'Space'], labelKey: 'a11y.keysSelectNode', group: 'graph' },
  { shortcuts: ['←↑↓→'], labelKey: 'a11y.keysMoveNode', group: 'graph' },
  { shortcuts: ['Backspace'], labelKey: 'a11y.keysDelete', group: 'graph' },
  { shortcuts: ['Shift+F10'], labelKey: 'a11y.keysLink', group: 'graph' },
  { shortcuts: ['Space'], labelKey: 'a11y.keysLibraryCard', group: 'graph' },
  { shortcuts: ['Enter'], labelKey: 'a11y.keysLibraryAdd', group: 'graph' },
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
                        <dd className={command.altShortcuts?.length ? styles.keys : undefined}>
                          <Shortcut shortcut={command.shortcut ?? ''} />
                          {(command.altShortcuts ?? []).map((shortcut) => <Shortcut key={shortcut} shortcut={shortcut} />)}
                        </dd>
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

/** Help ▸ About: the shared About view (also Settings ▸ About) with Close at the right. */
function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, styles.about, 'about-dialog')} aria-describedby={undefined}>
          <div className={styles.aboutBody}>
            <AboutContent renderTitle={(text, className) => <DialogTitle className={className}>{text}</DialogTitle>} />
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

/** Help ▸ Report a problem: what the new issue will carry, read before the browser opens. */
function ReportProblemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [details, setDetails] = React.useState('');
  React.useEffect(() => {
    if (!open) return;
    void window.electronAPI?.issueDraft?.().then((draft) => setDetails(draft.details)).catch(() => setDetails(''));
  }, [open]);
  const openIssue = async () => {
    const result = await window.electronAPI?.openProjectLink?.('issue').catch(() => ({ ok: false as const, error: 'failed' }));
    onOpenChange(false);
    if (!result || !result.ok) showToast({ id: 'project-link', tone: 'error', title: String(t('projectLinks.unavailable')) });
  };
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'report-problem-dialog')} aria-describedby="report-problem-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('projectLinks.reportTitle')}</DialogTitle>
            <DialogDescription id="report-problem-lead" className={styles.lead}>{t('projectLinks.reportLead')}</DialogDescription>
          </header>
          <pre className={styles.details} data-issue-details>{details}</pre>
          <p className={styles.hint}>{t('projectLinks.reportHint')}</p>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.cancel')}</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => void openIssue()}>{t('projectLinks.reportOpen')}</Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/** The words and the action of the replace dialog, by what replaces the graph. */
const REPLACE_COPY = {
  'new-project': { title: 'menu.newProjectTitle', body: 'menu.newProjectBody', confirm: 'menu.newProjectConfirm', run: startNewProject },
  'open-project': { title: 'menu.openProjectTitle', body: 'menu.openProjectBody', confirm: 'menu.openProjectConfirm', run: openProjectNow },
  'import-workflow': { title: 'menu.openWorkflowTitle', body: 'menu.openWorkflowBody', confirm: 'menu.openWorkflowConfirm', run: importWorkflowNow },
  // Every other way of opening (drop, Recent, Examples, command line) asks the same question as Open workflow.
  'open-file': { title: 'menu.openWorkflowTitle', body: 'menu.openWorkflowBody', confirm: 'menu.openWorkflowConfirm', run: runQueuedOpen },
} as const;

/**
 * File ▸ New project, Open project or Open workflow while the graph on screen is in no project file as it stands:
 * say what happens before the canvas takes another graph.
 */
function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const intent = useUiStore((state) => state.replaceIntent);
  const copy = REPLACE_COPY[intent];
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'new-project-dialog')} aria-describedby="new-project-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t(copy.title)}</DialogTitle>
            <DialogDescription id="new-project-lead" className={styles.lead}>{t(copy.body)}</DialogDescription>
          </header>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.cancel')}</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => void copy.run()}>{t(copy.confirm)}</Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/** How many findings or fields a guard dialog lists before "and N more", so the dialog stays short. */
const GUARD_ROWS = 6;

/** File ▸ Export with check findings: say what is wrong before a broken workflow is written. */
function ExportGuardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const report = useKnowledgeStore((state) => state.check);
  const nodes = useGraphStore((state) => state.nodes);
  // Name the nodes as the canvas does ("Load LoRA"), not by id.
  const findings = exportGuardFindings(report).map((finding) => ({ ...finding, values: nameFindingValues(finding.values, nodeNamer(nodes)) }));
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

/** Open, New or Import while the assistant builds: stop it first, then go on. */
function StopBuildDialog() {
  const { t } = useTranslation();
  const pending = useBuildGuardStore((state) => state.pending);
  const clear = useBuildGuardStore((state) => state.clear);
  return (
    <DialogRoot open={pending !== null} onOpenChange={(open) => { if (!open) clear(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'stop-build-dialog')} aria-describedby="stop-build-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('chat.stopBuildTitle')}</DialogTitle>
            <DialogDescription id="stop-build-lead" className={styles.lead}>{t('chat.stopBuildBody')}</DialogDescription>
          </header>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.cancel')}</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => void stopBuildAndGo()}>{t('chat.stopBuildConfirm')}</Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}

/**
 * Before a workflow or project file is written: fields that look like a key or token. Save without those values,
 * save as it is, or cancel. The values themselves are never shown; main kept them.
 */
function SecretGuardDialog() {
  const { t } = useTranslation();
  const pending = useSecretGuardStore((state) => state.pending);
  const clear = useSecretGuardStore((state) => state.clear);
  const fields = pending?.fields ?? [];
  const shown = fields.slice(0, GUARD_ROWS);
  const save = (choice: 'omit' | 'keep') => {
    // Read the target before clear() empties the store, then write with the person's choice.
    const target = pending?.target;
    clear();
    if (target === 'workflow') void exportWorkflowNow(choice);
    else if (target === 'project') void saveProjectFile(choice);
  };
  return (
    <DialogRoot open={pending !== null} onOpenChange={(open) => { if (!open) clear(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'secret-guard-dialog')} aria-describedby="secret-guard-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('secretGuard.title', { count: fields.length })}</DialogTitle>
            <DialogDescription id="secret-guard-lead" className={styles.lead}>{t('secretGuard.lead')}</DialogDescription>
          </header>
          <ul className={styles.findings}>
            {shown.map((field) => (
              <li key={`${field.nodeId}:${field.name}`} className={styles.finding}>{secretFieldLabel(field)}</li>
            ))}
            {fields.length > shown.length ? <li className={styles.note}>{t('exportGuard.more', { count: fields.length - shown.length })}</li> : null}
          </ul>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('exportGuard.cancel')}</Button>
            </DialogClose>
            <Button variant="subtle" size="sm" onClick={() => save('keep')}>{t('secretGuard.keep')}</Button>
            <Button variant="primary" size="sm" onClick={() => save('omit')}>{t('secretGuard.omit')}</Button>
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
      <HelpReader open={dialog === 'help'} onOpenChange={close} />
      <ReportProblemDialog open={dialog === 'report-problem'} onOpenChange={close} />
      <NewProjectDialog open={dialog === 'new-project'} onOpenChange={close} />
      <ExportGuardDialog open={dialog === 'export-guard'} onOpenChange={close} />
      <SecretGuardDialog />
      <StopBuildDialog />
      <SyncProblemsDialog open={dialog === 'sync-problems'} onOpenChange={close} />
      <SubgraphWizard />
      <GuidanceWizard />
    </>
  );
}
