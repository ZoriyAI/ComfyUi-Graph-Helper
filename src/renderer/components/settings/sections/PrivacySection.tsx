import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { DESKTOP_PROJECT_ID } from '../../../../shared/project';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP, megabytes } from '../../../../shared/agent/limits';
import Button from '../../../ui/Button';
import Switch from '../../../ui/Switch';
import SelectField from '../../../ui/SelectField';
import type { SecretStoreInfo } from '../../../../shared/contracts';
import { cx } from '../../../ui/cx';
import { useChatStore } from '../../../state/chatState';
import styles from '../SettingsPanel.module.css';
import { Group, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';

/** Settings ▸ Privacy: what the model sees, whether chat is kept, and a plain account of where secrets live. */
export default function PrivacySection({ prefs, setPrefs, container }: DraftProps) {
  const { t } = useTranslation();
  const privacy = prefs.privacy;
  const [note, setNote] = useState('');
  // Settings ▸ Privacy ▸ Password store: what the app found, and the person's choice for the next start.
  const [store, setStore] = useState<SecretStoreInfo | null>(null);
  const [storeNote, setStoreNote] = useState('');
  useEffect(() => {
    void window.electronAPI.secretStore().then(setStore).catch(() => undefined);
  }, []);
  const chooseStore = async (value: string) => {
    const choice = value === 'auto' ? null : (value as NonNullable<SecretStoreInfo['override']>);
    const result = await window.electronAPI.setSecretStore(choice).catch(() => ({ ok: false }));
    if (result.ok) {
      setStore((current) => (current ? { ...current, override: choice } : current));
      setStoreNote(String(t('preferences.secretStoreSaved')));
    }
  };
  const storeOptions = [
    { value: 'auto', label: String(t('preferences.secretStoreAuto')) },
    { value: 'gnome-libsecret', label: 'GNOME (Passwords and Keys / libsecret)' },
    { value: 'kwallet6', label: 'KWallet 6' },
    { value: 'kwallet5', label: 'KWallet 5' },
    { value: 'kwallet', label: 'KWallet 4' },
  ];
  const clearHistory = async () => {
    try {
      const result = await window.electronAPI.clearChatHistory(DESKTOP_PROJECT_ID);
      if (!result.ok) {
        setNote(String(t('preferences.historyNotCleared')));
        return;
      }
      useChatStore.getState().clearChat();
      setNote(String(t('preferences.historyCleared', { count: result.removed })));
    } catch {
      setNote(String(t('preferences.historyNotCleared')));
    }
  };
  return (
    <>
      <SectionHead title={String(t('preferences.nav.privacy'))} lead={String(t('preferences.lead.privacy'))} />
      <Switch label={t('preferences.sendFieldValues')} checked={privacy.sendFieldValues} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { sendFieldValues: next })} />
      <p className={hintClass}>{t('preferences.sendFieldValuesHint')}</p>
      <Switch label={t('preferences.saveChatHistory')} checked={privacy.saveChatHistory} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { saveChatHistory: next })} />
      <p className={hintClass}>{t('preferences.saveChatHistoryHint')}</p>
      <Group title={String(t('preferences.sentTitle'))} className={styles.explain}>
        <ul className={styles.facts}>
          <li>{t('preferences.sentAlways')}</li>
          <li className={privacy.sendFieldValues ? styles.factOn : styles.factOff}>{t(privacy.sendFieldValues ? 'preferences.sentValuesOn' : 'preferences.sentValuesOff')}</li>
          <li className={styles.factOff}>{t('preferences.sentNever')}</li>
          <li>{t('preferences.keysLive')}</li>
          <li className="web-limits">{t('preferences.webLimits', { bytes: megabytes(FETCH_PAGE_BYTE_CAP), chars: FETCH_PAGE_TEXT_CAP })}</li>
        </ul>
      </Group>
      <Group title={String(t('preferences.secretStoreTitle'))}>
        {store ? (
          <p className={hintClass} role="status">
            {t(store.persist ? 'preferences.secretStoreOk' : 'preferences.secretStoreOff', { backend: store.backend })}
          </p>
        ) : null}
        <SelectField
          label={String(t('preferences.secretStore'))}
          value={store?.override ?? 'auto'}
          options={storeOptions}
          container={container}
          onChange={(next) => void chooseStore(next)}
        />
        <p className={hintClass}>{t('preferences.secretStoreHint')}</p>
        {storeNote ? <p className={hintClass} role="status">{storeNote}</p> : null}
      </Group>
      <div className={cx(rowClass, styles.rowStart)}>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => void clearHistory()}>{t('preferences.clearHistory')}</Button>
      </div>
      <p className={hintClass}>{t('preferences.clearHistoryHint')}</p>
      {note ? <p className={hintClass} role="status">{note}</p> : null}
    </>
  );
}
