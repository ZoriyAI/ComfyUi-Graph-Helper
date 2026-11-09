import React from 'react';
import { FileCheck2, FolderOpen, FolderOutput, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import Hint from '../../ui/Hint';
import { cx } from '../../ui/cx';
import { useGraphStore } from '../../state/graphState';
import { isDirty, useUiStore } from '../../state/uiState';
import { useProjectionStore } from '../../services/commands/projection';
import { useKnowledgeStore, selectCheckCount } from '../../state/knowledgeState';
import type { GraphCheckReport } from '../../../shared/contracts';
import Badge from '../../ui/Badge';
import SyncIndicator from '../sync/SyncIndicator';
import styles from './AppBar.module.css';

/**
 * Findings in the last graph check; null before the first check.
 * (After the Chat/Explain merge this matches knowledgeState's selectCheckCount.)
 */
export function checkCount(check: GraphCheckReport | null): number | null {
  if (!check) return null;
  return check.missingNodes.length + check.missingModels.length + check.typeMismatches.length
    + check.baseModelMismatches.length + check.unconnectedRequiredInputs.length + check.unknownNodeTypes.length;
}

/** How the provider's key stands, shown as the colour of the chip's dot. */
export type ProviderKeyState = 'none' | 'test' | 'ok' | 'session' | 'missing';

export interface AppBarProps {
  provider: string;
  /** The full sentence (tooltip and screen readers). */
  providerNote: string;
  /** Short visible label: the provider name. */
  providerLabel: string;
  providerKey: ProviderKeyState;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onCheckGraph: () => void;
  onExport: () => void;
  /** The settings dialog trigger (SettingsPanel). */
  settings: React.ReactNode;
}

/**
 * Top frame bar (`.document-bar`): mark, project name and unsaved state, project file actions,
 * sync indicator, provider chip, Check graph, Export, Settings.
 */
export default function AppBar({ provider, providerNote, providerLabel, providerKey, onOpenProject, onSaveProject, onCheckGraph, onExport, settings }: AppBarProps) {
  const { t } = useTranslation();
  const title = useGraphStore((state) => state.process.title);
  const revSeq = useProjectionStore((state) => state.revSeq);
  const savedRevSeq = useUiStore((state) => state.savedRevSeq);
  const dirty = isDirty(savedRevSeq, revSeq);
  const name = title.trim() || String(t('shell.untitled'));
  const findings = useKnowledgeStore(selectCheckCount);

  return (
    <header className={cx(styles.bar, 'document-bar')}>
      <div className={cx(styles.brand, 'brand')}>
        <span className={cx(styles.mark, 'product-mark')} aria-hidden="true" />
        <h1 className={cx(styles.title, 'app-title')}>{t('shell.title')}</h1>
        <span className={cx(styles.project, 'project-chip')} title={name}>
          <span className={styles.projectName}>{name}</span>
          {dirty ? <span className={styles.dirty} role="img" aria-label={String(t('shell.dirty'))} title={String(t('shell.dirty'))} /> : null}
        </span>
        <span className={cx(styles.actions, 'project-actions')}>
          <Button size="sm" icon={<FolderOpen size={16} />} aria-label={String(t('project.open'))} onClick={onOpenProject}>
            <span className={styles.fileLabel}>{t('project.open')}</span>
          </Button>
          <Button size="sm" icon={<Save size={16} />} aria-label={String(t('project.save'))} onClick={onSaveProject}>
            <span className={styles.fileLabel}>{t('project.save')}</span>
          </Button>
        </span>
      </div>
      <div className={cx(styles.status, 'header-status')}>
        <SyncIndicator />
        <Hint label={providerNote}>
          <span className={cx(styles.chip, 'status-chip', 'provider-chip')} data-provider={provider || 'none'} role="status">
            <span className={styles.keyDot} data-key={providerKey} aria-hidden="true" />
            <span className={styles.chipLabel} aria-hidden="true">{providerLabel}</span>
            {/* The sentence stays in the status region for screen readers; sighted people read it in the tooltip. */}
            <span className="sr-only">{providerNote}</span>
          </span>
        </Hint>
        <span className={styles.rule} aria-hidden="true" />
        <Hint label={String(t('shell.checkGraphHint'))}>
          <Button variant="subtle" size="sm" icon={<FileCheck2 size={16} />} onClick={onCheckGraph}>
            {t('shell.checkGraph')}
            {findings !== null ? (
              <Badge tone={findings === 0 ? 'ok' : 'warn'} className={styles.count} aria-label={String(t('shell.checkFindings', { count: findings }))}>
                {findings}
              </Badge>
            ) : null}
          </Button>
        </Hint>
        <Hint label={String(t('shell.exportHint'))}>
          <Button size="sm" icon={<FolderOutput size={16} />} onClick={onExport}>
            {t('toolbar.export')}
          </Button>
        </Hint>
        {settings}
      </div>
    </header>
  );
}
