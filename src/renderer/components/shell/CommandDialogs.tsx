import React from 'react';
import { useTranslation } from 'react-i18next';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import Shortcut from '../../ui/Shortcut';
import { cx } from '../../ui/cx';
import { allCommands, type CommandGroup } from '../../commands/registry';
import { cancelReplacement, confirmReplacement, exportWorkflowNow, saveProjectFile, startNewProject } from '../../commands/actions';
import { secretFieldLabel, useSecretGuardStore } from '../../commands/secretGuard';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useDockStore } from '../../state/dockState';
import { exportGuardFindings } from '../../commands/exportGuard';
import { nameFindingValues, nodeNamer } from '../check/checkModel';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import AboutContent from './AboutContent';
import MarkdownLite from '../chat/MarkdownLite';
import type { HelpTopic } from '../../../shared/contracts/about';
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

const HELP_PAGES: Record<'help-guide' | 'help-troubleshooting' | 'help-whatsnew', { topic: HelpTopic; titleKey: string }> = {
  'help-guide': { topic: 'guide', titleKey: 'helpReader.guide' },
  'help-troubleshooting': { topic: 'troubleshooting', titleKey: 'helpReader.troubleshooting' },
  'help-whatsnew': { topic: 'whatsnew', titleKey: 'helpReader.whatsNew' },
};

/** The page's own first heading when it only repeats the reader's title. */
export function withoutTitle(markdown: string, title: string): string {
  const match = /^#\s+(.+)\n+/.exec(markdown);
  return match && match[1].trim() === title.trim() ? markdown.slice(match[0].length) : markdown;
}

/** Help ▸ User guide, Troubleshooting, What is new: the pages bundled with the app, read inside it. */
function HelpReaderDialog({ page, onOpenChange }: { page: keyof typeof HELP_PAGES | null; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const [text, setText] = React.useState<string | null>(null);
  const [missing, setMissing] = React.useState(false);
  const topic = page ? HELP_PAGES[page].topic : null;
  React.useEffect(() => {
    if (!topic) return undefined;
    let alive = true;
    setText(null);
    setMissing(false);
    const read = window.electronAPI?.readHelp?.(topic, language);
    if (!read) {
      setMissing(true);
      return undefined;
    }
    void read.then((result) => {
      if (!alive) return;
      if (result.ok) setText(result.text);
      else setMissing(true);
    }).catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [topic, language]);
  return (
    <DialogRoot open={page !== null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, styles.wide, styles.reader, 'help-reader-dialog')} aria-describedby={undefined} data-help-topic={topic ?? undefined}>
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{page ? t(HELP_PAGES[page].titleKey) : ''}</DialogTitle>
            {topic === 'whatsnew' && language === 'en' ? <p className={styles.lead}>{t('helpReader.russianOnly')}</p> : null}
          </header>
          <div className={styles.readerBody} tabIndex={0}>
            {missing ? <p className={styles.note}>{t('helpReader.missing')}</p> : text === null ? <p className={styles.note}>{t('helpReader.loading')}</p> : <MarkdownLite text={withoutTitle(text, page ? String(t(HELP_PAGES[page].titleKey)) : '')} />}
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

/** Opening another project or workflow with unsaved work: the current graph is replaced only after confirmation. */
function ReplaceProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <DialogRoot open={open} onOpenChange={(next) => { if (!next) cancelReplacement(); onOpenChange(next); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'replace-project-dialog')} aria-describedby="replace-project-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('menu.replaceProjectTitle')}</DialogTitle>
            <DialogDescription id="replace-project-lead" className={styles.lead}>{t('menu.replaceProjectBody')}</DialogDescription>
          </header>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.cancel')}</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => void confirmReplacement()}>{t('menu.replaceProjectConfirm')}</Button>
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
      <HelpReaderDialog page={dialog === 'help-guide' || dialog === 'help-troubleshooting' || dialog === 'help-whatsnew' ? dialog : null} onOpenChange={close} />
      <NewProjectDialog open={dialog === 'new-project'} onOpenChange={close} />
      <ReplaceProjectDialog open={dialog === 'replace-project'} onOpenChange={close} />
      <ExportGuardDialog open={dialog === 'export-guard'} onOpenChange={close} />
      <SecretGuardDialog />
    </>
  );
}
