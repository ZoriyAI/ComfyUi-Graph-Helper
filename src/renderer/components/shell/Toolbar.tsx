import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Hint from '../../ui/Hint';
import SelectField from '../../ui/SelectField';
import Shortcut from '../../ui/Shortcut';
import { cx } from '../../ui/cx';
import { hintOf, runCommand, useCommandState } from '../../commands/registry';
import { useGraphStore } from '../../state/graphState';
import { isDirty, useUiStore } from '../../state/uiState';
import { useKnowledgeStore, selectCheckCount } from '../../state/knowledgeState';
import { PROVIDER_CHOICES, useProviderStore } from '../../state/providerState';
import { useProjectionStore } from '../../services/commands/projection';
import styles from './Toolbar.module.css';

/**
 * One icon button for a registry command. The accessible name is the command label (kept as text, so
 * `getByRole('button', { name: 'Import' })` and the text content both read it); the tooltip adds the
 * shortcut, or the reason when the command is off.
 */
export function ToolButton({ id, children }: { id: string; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const { command, enabled, checked } = useCommandState(id);
  if (!command) return null;
  const Icon = command.icon;
  const label = String(t(command.labelKey));
  const hint = hintOf(id) ?? (!enabled && command.hintKey ? String(t(command.hintKey)) : label);
  return (
    <Hint label={hint} side="bottom" shortcut={command.shortcut && enabled ? <Shortcut shortcut={command.shortcut} /> : undefined}>
      <Button
        className={cx(styles.tool, children ? styles.withBadge : undefined)}
        icon={Icon ? <Icon size={16} aria-hidden="true" /> : undefined}
        disabled={!enabled}
        aria-pressed={checked === undefined ? undefined : checked}
        data-command={id}
        onClick={() => void runCommand(id)}
      >
        <span className="sr-only">{label}</span>
        {children}
      </Button>
    </Hint>
  );
}

/** The class of a toolbar icon button, for buttons that are not commands (the settings trigger). */
export const toolButtonClass = styles.tool;

function Rule() {
  return <span className={styles.rule} aria-hidden="true" />;
}

/** Findings of the last check, as a small badge on the Check graph button. */
function CheckBadge() {
  const { t } = useTranslation();
  const findings = useKnowledgeStore(selectCheckCount);
  if (findings === null) return null;
  return (
    <Badge tone={findings === 0 ? 'ok' : 'warn'} className={styles.count} aria-label={String(t('shell.checkFindings', { count: findings }))}>
      {findings}
    </Badge>
  );
}

/** The project name as plain text, with a dot while there are unsaved changes. */
function ProjectName() {
  const { t } = useTranslation();
  const title = useGraphStore((state) => state.process.title);
  const revSeq = useProjectionStore((state) => state.revSeq);
  const savedRevSeq = useUiStore((state) => state.savedRevSeq);
  const dirty = isDirty(savedRevSeq, revSeq);
  const name = title.trim() || String(t('shell.untitled'));
  return (
    <span className={cx(styles.project, 'project-chip')} title={String(t('menu.projectName', { name }))}>
      <span className={styles.projectName}>{name}</span>
      {dirty ? <span className={styles.dirty} role="img" aria-label={String(t('shell.dirty'))} title={String(t('shell.dirty'))} /> : null}
    </span>
  );
}

/**
 * The compact toolbar under the menu bar (`.workspace-toolbar`, 36 px): icon buttons from the command
 * registry in groups — project · workflow · history · graph · check · sync — then the chat provider,
 * the project name and the settings button.
 */
export default function Toolbar({ settings }: { settings?: React.ReactNode }) {
  const { t } = useTranslation();
  const provider = useProviderStore((state) => state.provider);
  const choose = useProviderStore((state) => state.choose);
  const options = PROVIDER_CHOICES.map((choice) => ({ value: choice.value, label: String(t(choice.labelKey)) }));
  return (
    <div className={cx(styles.toolbar, 'workspace-toolbar')} role="toolbar" aria-label={String(t('toolbar.aria'))}>
      <ToolButton id="file.new" />
      <ToolButton id="file.open" />
      <ToolButton id="file.save" />
      <Rule />
      <ToolButton id="file.import" />
      <ToolButton id="file.export" />
      <ToolButton id="file.catalog" />
      <Rule />
      <ToolButton id="edit.undo" />
      <ToolButton id="edit.redo" />
      <Rule />
      <ToolButton id="graph.addNode" />
      <ToolButton id="view.fit" />
      <ToolButton id="view.descriptions" />
      <Rule />
      <ToolButton id="graph.check"><CheckBadge /></ToolButton>
      <Rule />
      <ToolButton id="sync.now" />
      <span className={styles.spacer} aria-hidden="true" />
      <SelectField id="chat-provider" label={String(t('provider.label'))} value={provider} options={options} onChange={(next) => void choose(next)} />
      <Rule />
      <ProjectName />
      {settings}
    </div>
  );
}
