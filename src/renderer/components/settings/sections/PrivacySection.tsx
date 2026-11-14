import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser, Trash2 } from 'lucide-react';
import { DESKTOP_PROJECT_ID } from '../../../../shared/project';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP, megabytes } from '../../../../shared/agent/limits';
import Button from '../../../ui/Button';
import Switch from '../../../ui/Switch';
import SelectField from '../../../ui/SelectField';
import { CLOUD_KEY_PROVIDERS, type CloudKeyProvider, type McpTokenStatus, type SecretStatus, type SecretStoreInfo } from '../../../../shared/contracts';
import { NO_KEYS, refreshKeySources, useProviderStore, type KeySource } from '../../../state/providerState';

/** The password store Electron reports (`safeStorage.getSelectedStorageBackend()`), as a name a person knows. */
const STORE_NAME_KEYS: Record<string, string> = {
  gnome_libsecret: 'preferences.secretStoreName.gnome',
  kwallet6: 'preferences.secretStoreName.kwallet6',
  kwallet5: 'preferences.secretStoreName.kwallet5',
  kwallet: 'preferences.secretStoreName.kwallet4',
  basic_text: 'preferences.secretStoreName.plain',
  'platform-default': 'preferences.secretStoreName.system',
};
const storeNameKey = (backend: string): string => STORE_NAME_KEYS[backend] ?? 'preferences.secretStoreName.unknown';

const KEY_PROVIDER_NAMES: Record<CloudKeyProvider, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };
import { tokenPlaceKey } from '../mcpAccess';
import { cx } from '../../../ui/cx';
import { useChatStore } from '../../../state/chatState';
import styles from '../SettingsPanel.module.css';
import { Group, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';
import ConfirmDialog from './ConfirmDialog';
import PreviewCacheRow from './PreviewCacheRow';
import type { SecretInventoryReport } from '../../../../preload';

/** Settings ▸ Privacy: what the model sees, whether chat is kept, and a plain account of where secrets live. */
export default function PrivacySection({ prefs, setPrefs, container }: DraftProps) {
  const { t } = useTranslation();
  const privacy = prefs.privacy;
  const [note, setNote] = useState('');
  // Settings ▸ Privacy ▸ Password store: what the app found, and the person's choice for the next start.
  const [store, setStore] = useState<SecretStoreInfo | null>(null);
  const [storeNote, setStoreNote] = useState('');
  // Without a password store keys live only until the app closes: said here, where keys are accounted for.
  const [canPersist, setCanPersist] = useState<boolean | null>(null);
  useEffect(() => {
    void window.electronAPI.secretStore().then(setStore).catch(() => undefined);
    void window.electronAPI.secretStatus().then((status) => setCanPersist(status.persist)).catch(() => undefined);
  }, []);
  const chooseStore = async (value: string) => {
    const choice = value === 'auto' ? null : (value as NonNullable<SecretStoreInfo['override']>);
    const result = await window.electronAPI.setSecretStore(choice).catch(() => ({ ok: false }));
    if (result.ok) {
      setStore((current) => (current ? { ...current, override: choice } : current));
      setStoreNote(String(t('preferences.secretStoreSaved')));
    }
  };
  // Where the secrets are right now: the model key and the server token, never the values.
  // One row per cloud provider that has a key, held now or remembered (a remembered key the OS store could not open
  // at start still counts: «Забыть все» must say it is there before it removes it).
  const keySources = useProviderStore((state) => state.keySources);
  const [remembered, setRemembered] = useState<SecretStatus['providers'] | null>(null);
  const [token, setToken] = useState<McpTokenStatus | null>(null);
  const [forgetNote, setForgetNote] = useState('');
  const refreshToken = () => window.electronAPI.mcpTokenStatus().then(setToken).catch(() => undefined);
  const refreshKeys = async () => {
    await refreshKeySources().catch(() => undefined);
    await window.electronAPI.secretStatus().then((status) => setRemembered(status.providers ?? null)).catch(() => undefined);
  };
  useEffect(() => {
    void refreshToken();
    void refreshKeys();
  }, []);
  const keyPlace = (source: KeySource): string => (source === 'os' ? 'preferences.placeOs' : source === 'file' ? 'preferences.placeFile' : source === 'session' ? 'preferences.placeSession' : 'preferences.placeNone');
  const keyRows = CLOUD_KEY_PROVIDERS.map((provider) => {
    const held = keySources[provider];
    const saved = remembered?.[provider];
    const source: KeySource = held !== 'none' ? held : saved?.stored ? 'os' : saved?.inFile ? 'file' : 'none';
    return { provider, source };
  }).filter((row) => row.source !== 'none');
  // What Forget all would remove now (names and counts from main), shown in the question and the result.
  const [inventory, setInventory] = useState<SecretInventoryReport | null>(null);
  const [askForget, setAskForget] = useState(false);
  const refreshInventory = () => window.electronAPI.secretInventory().then(setInventory).catch(() => undefined);
  useEffect(() => {
    void refreshInventory();
  }, [keySources, token]);
  const inventoryItems = (found: SecretInventoryReport | null): string[] => {
    if (!found) return [];
    const items: string[] = [];
    if (found.providers.length > 0) items.push(String(t('preferences.forgetItemKeys', { providers: found.providers.map((provider) => KEY_PROVIDER_NAMES[provider]).join(', ') })));
    if (found.serverTokens > 0) items.push(String(t('preferences.forgetItemTokens', { count: found.serverTokens })));
    if (found.signIns > 0) items.push(String(t('preferences.forgetItemSignIns', { count: found.signIns })));
    return items;
  };
  const toForget = inventoryItems(inventory);
  // The sections stay mounted while another tab shows: read again whenever this one comes into view.
  const viewRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = viewRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      void refreshInventory();
      void refreshToken();
      void refreshKeys();
      void refreshStored();
    });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const forgetEverything = async () => {
    const result = await window.electronAPI.forgetAllSecrets();
    useProviderStore.getState().setKeySources(NO_KEYS);
    await refreshKeys();
    await refreshToken();
    await refreshInventory();
    const removed = inventoryItems(result.removed);
    setForgetNote(removed.length > 0 ? String(t('preferences.forgotAll', { items: removed.join('; ') })) : String(t('preferences.forgetNothing')));
  };
  const storeOptions = [
    { value: 'auto', label: String(t('preferences.secretStoreAuto')) },
    { value: 'gnome-libsecret', label: String(t('preferences.secretStoreName.gnome')) },
    { value: 'kwallet6', label: String(t('preferences.secretStoreName.kwallet6')) },
    { value: 'kwallet5', label: String(t('preferences.secretStoreName.kwallet5')) },
    { value: 'kwallet', label: String(t('preferences.secretStoreName.kwallet4')) },
  ];
  // How many messages there are: stored ones, and those only in this window when saving is off.
  const windowMessages = useChatStore((state) => state.messages.length);
  const [storedMessages, setStoredMessages] = useState<number | null>(null);
  const [askClear, setAskClear] = useState(false);
  const refreshStored = () => window.electronAPI.loadChatHistory(DESKTOP_PROJECT_ID).then((records) => setStoredMessages(records.length)).catch(() => setStoredMessages(null));
  useEffect(() => {
    void refreshStored();
  }, [windowMessages]);
  const messageCount = Math.max(storedMessages ?? 0, windowMessages);
  const clearHistory = async () => {
    try {
      const result = await window.electronAPI.clearChatHistory(DESKTOP_PROJECT_ID);
      if (!result.ok) {
        setNote(String(t('preferences.historyNotCleared')));
        return;
      }
      const shown = useChatStore.getState().messages.length;
      useChatStore.getState().clearChat();
      await refreshStored();
      setNote(String(t('preferences.historyCleared', { count: Math.max(result.removed, shown) })));
    } catch {
      setNote(String(t('preferences.historyNotCleared')));
    }
  };
  return (
    <>
      <div ref={viewRef} aria-hidden="true" />
      <SectionHead title={String(t('preferences.nav.privacy'))} lead={String(t('preferences.lead.privacy'))} />
      <Switch label={t('preferences.sendFieldValues')} checked={privacy.sendFieldValues} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { sendFieldValues: next })} />
      <p className={hintClass}>{t('preferences.sendFieldValuesHint')}</p>
      <Switch label={t('preferences.saveChatHistory')} checked={privacy.saveChatHistory} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { saveChatHistory: next })} />
      <p className={hintClass}>{t('preferences.saveChatHistoryHint')}</p>
      <Switch label={t('preferences.modelLog')} checked={privacy.modelLog} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { modelLog: next })} />
      <p className={hintClass}>{t('preferences.modelLogHint')}</p>
      <Switch label={t('preferences.showMarkedPreviews')} checked={privacy.showMarkedPreviews} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { showMarkedPreviews: next })} />
      <p className={hintClass}>{t('preferences.showMarkedPreviewsHint')}</p>
      <Switch label={t('preferences.lookupModelsOnline')} checked={privacy.lookupModelsOnline} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { lookupModelsOnline: next })} />
      <p className={hintClass}>{t('preferences.lookupModelsOnlineHint')}</p>
      <Switch label={t('updates.check')} checked={privacy.checkUpdates} onCheckedChange={(next) => patchSection(setPrefs, 'privacy', { checkUpdates: next })} />
      <p className={hintClass}>{t('updates.checkHint')}</p>
      <Group title={String(t('preferences.sentTitle'))} className={styles.explain}>
        <ul className={styles.facts}>
          <li>{t('preferences.sentAlways')}</li>
          <li className={privacy.sendFieldValues ? styles.factOn : styles.factOff}>{t(privacy.sendFieldValues ? 'preferences.sentValuesOn' : 'preferences.sentValuesOff')}</li>
          <li className={styles.factOff}>{t('preferences.sentNever')}</li>
          <li className="sent-elsewhere">{t('preferences.sentElsewhere')}</li>
          <li>{t('preferences.keysLive')}</li>
          <li className="web-limits">{t('preferences.webLimits', { bytes: megabytes(FETCH_PAGE_BYTE_CAP), chars: FETCH_PAGE_TEXT_CAP })}</li>
        </ul>
      </Group>
      {canPersist === false ? <p className={cx(hintClass, styles.keyStoreNote, 'key-store-note')}>{t('settings.keyReason')}</p> : null}
      <Group>
        <table className={styles.table}>
          <caption className={styles.caption}>{t('preferences.secretsTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('preferences.secretColumn')}</th>
              <th scope="col">{t('preferences.placeColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {keyRows.length === 0 ? (
              <tr>
                <th scope="row">{t('preferences.providerKeyRow')}</th>
                <td><span className={styles.placeDot} aria-hidden="true" />{t('preferences.placeNone')}</td>
              </tr>
            ) : keyRows.map((row) => (
              <tr key={row.provider} data-provider={row.provider}>
                <th scope="row">{t('preferences.providerKeyRowFor', { provider: KEY_PROVIDER_NAMES[row.provider] })}</th>
                <td><span className={cx(styles.placeDot, styles.placeOn)} aria-hidden="true" />{t(keyPlace(row.source))}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">{t('preferences.tokenRow')}</th>
              <td><span className={cx(styles.placeDot, token?.held && styles.placeOn)} aria-hidden="true" />{t(token ? tokenPlaceKey(token) : 'settings.tokenPlaceNone')}</td>
            </tr>
          </tbody>
        </table>
        <div className={cx(rowClass, styles.rowStart)}>
          <Button size="sm" variant="danger" className="forget-all" disabled={toForget.length === 0} icon={<Eraser size={14} aria-hidden="true" />} onClick={() => setAskForget(true)}>{t('preferences.forgetAll')}</Button>
        </div>
        <p className={hintClass}>{t(toForget.length === 0 && inventory ? 'preferences.forgetNothing' : 'preferences.forgetAllHint')}</p>
        <ConfirmDialog
          className="forget-all-dialog"
          open={askForget}
          onOpenChange={setAskForget}
          title={String(t('preferences.forgetAllConfirmTitle'))}
          lead={String(t('preferences.forgetAllConfirmLead'))}
          items={toForget}
          confirmLabel={String(t('preferences.forgetConfirm'))}
          cancelLabel={String(t('preferences.confirmCancel'))}
          onConfirm={() => void forgetEverything()}
        />
        {forgetNote ? <p className={hintClass} role="status">{forgetNote}</p> : null}
      </Group>
      <Group title={String(t('preferences.secretStoreTitle'))}>
        {store ? (
          <p className={hintClass} role="status">
            {t(store.persist ? 'preferences.secretStoreOk' : 'preferences.secretStoreOff', { backend: t(storeNameKey(store.backend)) })}
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
        <Button size="sm" variant="danger" className="clear-history" disabled={messageCount === 0} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setAskClear(true)}>{t('preferences.clearHistory')}</Button>
      </div>
      <p className={hintClass}>{t(messageCount === 0 && storedMessages !== null ? 'preferences.historyEmpty' : 'preferences.clearHistoryHint')}</p>
      <ConfirmDialog
        className="clear-history-dialog"
        open={askClear}
        onOpenChange={setAskClear}
        title={String(t('preferences.clearHistoryConfirmTitle'))}
        lead={String(t('preferences.clearHistoryConfirmLead', { count: messageCount }))}
        confirmLabel={String(t('preferences.clearConfirm'))}
        cancelLabel={String(t('preferences.confirmCancel'))}
        onConfirm={() => void clearHistory()}
      />
      {note ? <p className={hintClass} role="status">{note}</p> : null}
      <PreviewCacheRow />
    </>
  );
}
