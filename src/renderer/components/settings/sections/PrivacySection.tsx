import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { DESKTOP_PROJECT_ID } from '../../../../shared/project';
import Button from '../../../ui/Button';
import Switch from '../../../ui/Switch';
import { cx } from '../../../ui/cx';
import { useChatStore } from '../../../state/chatState';
import styles from '../SettingsPanel.module.css';
import { Group, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';

/** Settings ▸ Privacy: what the model sees, whether chat is kept, and a plain account of where secrets live. */
export default function PrivacySection({ prefs, setPrefs }: DraftProps) {
  const { t } = useTranslation();
  const privacy = prefs.privacy;
  const [note, setNote] = useState('');
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
        </ul>
      </Group>
      <div className={cx(rowClass, styles.rowStart)}>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => void clearHistory()}>{t('preferences.clearHistory')}</Button>
      </div>
      <p className={hintClass}>{t('preferences.clearHistoryHint')}</p>
      {note ? <p className={hintClass} role="status">{note}</p> : null}
    </>
  );
}
