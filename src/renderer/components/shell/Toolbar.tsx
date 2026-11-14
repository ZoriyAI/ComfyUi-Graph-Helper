import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Hint from '../../ui/Hint';
import SelectField from '../../ui/SelectField';
import Shortcut from '../../ui/Shortcut';
import { cx } from '../../ui/cx';
import { hintOf, runCommand, useCommandState } from '../../commands/registry';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useProjectFileStore } from '../../services/projectFile';
import { useKnowledgeStore, selectCheckCount } from '../../state/knowledgeState';
import { usePreferencesStore } from '../../state/preferencesState';
import { isPreferenceProvider } from '../../../shared/config/preferences';
import { providerChoices, providerKeyState, providerNoteKey, useProviderStore } from '../../state/providerState';
import { useProjectionStore } from '../../services/commands/projection';
import { modelDisplayName } from './modelDisplayName';
import styles from './Toolbar.module.css';

/**
 * One button for a registry command. The accessible name is the command label (kept as text, so
 * `getByRole('button', { name: 'Open workflow…' })` and the text content both read it); the tooltip adds the
 * shortcut, or the reason when the command is off. A primary action also shows a short word (`shortKey`) when
 * the window is wide enough; that word is drawn only, so the accessible name stays the full label.
 */
export function ToolButton({ id, shortKey, children }: { id: string; shortKey?: string; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const { command, enabled, checked } = useCommandState(id);
  if (!command) return null;
  const Icon = command.icon;
  const label = String(t(command.labelKey));
  const hint = hintOf(id) ?? (!enabled && command.hintKey ? String(t(command.hintKey)) : label);
  return (
    <Hint label={hint} side="bottom" shortcut={command.shortcut && enabled ? <Shortcut shortcut={command.shortcut} /> : undefined}>
      <Button
        className={cx(styles.tool, children ? styles.withBadge : undefined, shortKey ? styles.withWord : undefined)}
        icon={Icon ? <Icon size={16} aria-hidden="true" /> : undefined}
        disabled={!enabled}
        aria-pressed={checked === undefined ? undefined : checked}
        data-command={id}
        onClick={() => void runCommand(id)}
      >
        <span className="sr-only">{label}</span>
        {shortKey ? <span className={styles.word} aria-hidden="true">{t(shortKey)}</span> : null}
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
  // The count is drawn only: the check now runs by itself after an open, and the button keeps its name
  // ("Check graph") whatever the count is. Screen readers hear the count from CheckStatus beside the button.
  return (
    <Badge tone={findings === 0 ? 'ok' : 'warn'} className={styles.count} aria-hidden="true">
      {findings}
    </Badge>
  );
}

/** The number of findings, said once to screen readers when it changes. */
function CheckStatus() {
  const { t } = useTranslation();
  const findings = useKnowledgeStore(selectCheckCount);
  return <span className="sr-only" role="status">{findings === null ? '' : t('shell.checkFindings', { count: findings })}</span>;
}

/** The project name as plain text, with a dot while there are unsaved changes. */
function ProjectName() {
  const { t } = useTranslation();
  const title = useGraphStore((state) => state.process.title);
  const file = useProjectFileStore((state) => state.state);
  const dirty = file?.dirty ?? false;
  const name = title.trim() || String(t('shell.untitled'));
  const chipTitle = file?.fileName ? String(t('menu.projectFile', { name, file: file.fileName })) : String(t('menu.projectName', { name }));
  return (
    <span className={cx(styles.project, 'project-chip')} title={chipTitle} data-dirty={dirty ? 'true' : 'false'}>
      <span className={styles.projectName}>{name}</span>
      {dirty ? <span className={styles.dirty} role="img" aria-label={String(t('shell.dirty'))} title={`${String(t('shell.dirty'))}. ${String(t('shell.dirtyHint'))}`} /> : null}
    </span>
  );
}

/** The model the chosen helper answers with: the stored one for the stored provider, else the one it had last. */
function useHelperModel(provider: string): string {
  const stored = useProviderStore((state) => state.stored);
  const providers = usePreferencesStore((state) => state.preferences.providers);
  if (!provider || provider === 'test') return '';
  if (stored.provider === provider) return stored.model;
  return isPreferenceProvider(provider) ? providers[provider]?.model ?? '' : '';
}

/**
 * The one control for the helper: an icon with a dot for where its key stands, "Assistant: <name> · <model>",
 * the providers to switch to, and "Set up…" for Settings ▸ Assistant. The sentence about the key heads the open
 * list and is a polite status for screen readers (the menu bar has no second chip that says the same).
 */
function HelperSelect() {
  const { t } = useTranslation();
  const provider = useProviderStore((state) => state.provider);
  const keySource = useProviderStore((state) => state.keySource);
  const choose = useProviderStore((state) => state.choose);
  const model = useHelperModel(provider);
  const choices = providerChoices();
  const options = choices.map((choice) => ({ value: choice.value, label: String(t(choice.labelKey)) }));
  const name = String(t((choices.find((choice) => choice.value === provider) ?? choices[0]).labelKey));
  const display = !provider
    ? String(t('provider.currentNone'))
    : model ? String(t('provider.currentModel', { name, model: modelDisplayName(model) })) : String(t('provider.current', { name }));
  const note = String(t(providerNoteKey(provider, keySource)));
  return (
    <div className={cx(styles.helper, 'helper-select')} data-key={providerKeyState(provider, keySource)}>
      <SelectField
        id="chat-provider"
        label={String(t('provider.label'))}
        value={provider}
        options={options}
        onChange={(next) => void choose(next)}
        icon={<Sparkles size={14} className={styles.helperIcon} aria-hidden="true" />}
        display={display}
        note={note}
        actions={[{ label: String(t('provider.configure')), onSelect: () => useUiStore.getState().openSettings('assistant') }]}
      />
      <span className="sr-only" role="status">{note}</span>
    </div>
  );
}

/**
 * The compact toolbar under the menu bar (`.workspace-toolbar`, 36 px): the project and file actions, history,
 * the check and sync, then the helper, the project name and the settings button. Canvas actions (add a node,
 * fit, zoom, descriptions, tour) live on the canvas toolbar only, so each action has one home on screen.
 */
export default function Toolbar({ settings }: { settings?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={cx(styles.toolbar, 'workspace-toolbar')} role="toolbar" aria-label={String(t('toolbar.aria'))}>
      <ToolButton id="file.new" shortKey="toolbar.newShort" />
      <ToolButton id="file.open" shortKey="toolbar.openShort" />
      <ToolButton id="file.save" shortKey="toolbar.saveShort" />
      <Rule />
      <ToolButton id="file.import" shortKey="toolbar.importShort" />
      <ToolButton id="file.export" shortKey="toolbar.exportShort" />
      <Rule />
      <ToolButton id="edit.undo" />
      <ToolButton id="edit.redo" />
      <Rule />
      <ToolButton id="graph.check" shortKey="toolbar.checkShort"><CheckBadge /></ToolButton>
      <CheckStatus />
      <ToolButton id="sync.now" />
      <span className={styles.spacer} aria-hidden="true" />
      <HelperSelect />
      <Rule />
      <ProjectName />
      {settings}
    </div>
  );
}
