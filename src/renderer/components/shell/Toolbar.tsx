import React from 'react';
import { FolderInput, Redo2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import Hint from '../../ui/Hint';
import SelectField from '../../ui/SelectField';
import { cx } from '../../ui/cx';
import { ToolToggles } from './Dock';
import styles from './Toolbar.module.css';

export interface ProviderOption {
  value: string;
  label: string;
}

/** Workspace toolbar (`.workspace-toolbar`): import, catalog snapshot, history, dock toggles, chat provider. */
export default function Toolbar({
  provider,
  providerOptions,
  onProvider,
  onImport,
  onCatalog,
}: {
  provider: string;
  providerOptions: ProviderOption[];
  onProvider: (next: string) => void;
  onImport: () => void;
  onCatalog: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={cx(styles.toolbar, 'workspace-toolbar')} role="toolbar" aria-label={String(t('toolbar.aria'))}>
      <Button icon={<FolderInput size={16} />} onClick={onImport}>{t('toolbar.import')}</Button>
      <Button onClick={onCatalog}>{t('toolbar.catalog')}</Button>
      <span className={styles.rule} aria-hidden="true" />
      <Hint label={String(t('toolbar.undoHint'))}>
        <Button icon={<Undo2 size={16} />} disabled title={String(t('toolbar.undoHint'))}>{t('toolbar.undo')}</Button>
      </Hint>
      <Hint label={String(t('toolbar.redoHint'))}>
        <Button icon={<Redo2 size={16} />} disabled title={String(t('toolbar.redoHint'))}>{t('toolbar.redo')}</Button>
      </Hint>
      <span className={styles.rule} aria-hidden="true" />
      <ToolToggles />
      <span className={styles.spacer} aria-hidden="true" />
      <SelectField id="chat-provider" label={String(t('provider.label'))} value={provider} options={providerOptions} onChange={onProvider} />
    </div>
  );
}
