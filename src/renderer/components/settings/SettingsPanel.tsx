import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Info, Keyboard, KeyRound, LayoutGrid, Palette, Plug, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { secretBearingFields, settingsWriteError } from '../../../shared/config/draft';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';
import {
  isPreferenceProvider,
  parsePreferences,
  preferencesWriteError,
  samePreferences,
  type Preferences,
} from '../../../shared/config/preferences';
import { explainError, languageOf, type Translator } from '../../../shared/i18n';
import { applyLanguage } from '../../i18n';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '../../ui/Dialog';
import Button from '../../ui/Button';
import { CLOSE_OPEN_SELECT } from '../../ui/SelectField';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import { cx } from '../../ui/cx';
import SyncSection from './SyncSection';
import AssistantSection from './sections/AssistantSection';
import ModelsSection from './sections/ModelsSection';
import ConnectionSection from './sections/ConnectionSection';
import CanvasSection from './sections/CanvasSection';
import AppearanceSection from './sections/AppearanceSection';
import ShortcutsSection from './sections/ShortcutsSection';
import PrivacySection from './sections/PrivacySection';
import AboutSection from './sections/AboutSection';
import { fieldClass, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './sections/common';
import { SETTINGS_SECTIONS, useUiStore, type SettingsSection } from '../../state/uiState';
import { usePreferencesStore } from '../../state/preferencesState';
import { refreshSyncStatus, useKnowledgeStore } from '../../state/knowledgeState';
import { SETTINGS_CHANGED } from '../../commands/events';
import { showToast } from '../../ui/toastStore';
import { detectionNote, shouldDetectAfterSave } from './mcpAccess';
import styles from './SettingsPanel.module.css';

function applyMotion(motion: NonSecretSettings['motion']) {
  document.documentElement.dataset.motion = motion;
}

function sameSettings(left: NonSecretSettings, right: NonSecretSettings) {
  return left.theme === right.theme
    && left.motion === right.motion
    && left.provider === right.provider
    && left.model === right.model
    && left.baseURL === right.baseURL
    && left.comfyOrigin === right.comfyOrigin
    && left.mcpUrl === right.mcpUrl
    && left.mcpAuth === right.mcpAuth
    && left.language === right.language;
}

const SECTION_META: Record<SettingsSection, { labelKey: string; icon: LucideIcon }> = {
  assistant: { labelKey: 'preferences.nav.assistant', icon: Bot },
  models: { labelKey: 'preferences.nav.models', icon: KeyRound },
  connection: { labelKey: 'preferences.nav.connection', icon: Plug },
  sync: { labelKey: 'preferences.nav.sync', icon: RefreshCw },
  canvas: { labelKey: 'preferences.nav.canvas', icon: LayoutGrid },
  appearance: { labelKey: 'preferences.nav.appearance', icon: Palette },
  shortcuts: { labelKey: 'preferences.nav.shortcuts', icon: Keyboard },
  privacy: { labelKey: 'preferences.nav.privacy', icon: ShieldCheck },
  about: { labelKey: 'preferences.nav.about', icon: Info },
};

type NoteState = { kind: 'key'; key: string } | { kind: 'error'; code: string };

/**
 * The stored provider's model and base URL also seed its remembered entry, so switching away and back in the
 * draft restores them even for a row saved before preferences existed. Applied to the saved and the draft copy.
 */
function seedProviders(values: NonSecretSettings, preferences: Preferences): Preferences {
  if (!isPreferenceProvider(values.provider)) return preferences;
  const entry = preferences.providers[values.provider];
  if (entry.model === values.model && entry.baseURL === values.baseURL) return preferences;
  return { ...preferences, providers: { ...preferences.providers, [values.provider]: { model: values.model, baseURL: values.baseURL } } };
}

/**
 * The Preferences window: a section list on the left, the section on the right, Save and Cancel below.
 * Non-secret values and preferences save together and fail closed (a secret in any field blocks the save);
 * keys and tokens go only to memory or OS storage through their own buttons. Sync's schedule applies at once.
 */
export default function SettingsPanel({
  onRead,
  onSaved,
  onSession,
  triggerIcon,
  trigger,
}: {
  onRead: (values: NonSecretSettings) => void;
  onSaved: (values: NonSecretSettings) => void;
  onSession: (source: 'none' | 'session' | 'os') => void;
  triggerIcon?: React.ReactNode;
  /** The button that opens the dialog (focus returns to it). Defaults to a small "Settings" button. */
  trigger?: React.ReactElement;
}) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const savedRef = useRef<NonSecretSettings>(nonSecretDefaults);
  const savedPrefsRef = useRef<Preferences>(parsePreferences({}));
  const onReadRef = useRef(onRead);
  const onSavedRef = useRef(onSaved);
  onReadRef.current = onRead;
  onSavedRef.current = onSaved;
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('connection');
  const [values, setValues] = useState<NonSecretSettings>(nonSecretDefaults);
  const [prefs, setPrefs] = useState<Preferences>(() => parsePreferences({}));
  const [note, setNote] = useState<NoteState>({ kind: 'key', key: 'settings.notSavedYet' });
  const [pending, setPending] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  const adoptPreferences = (stored: Preferences, row: NonSecretSettings) => {
    const seeded = seedProviders(row, stored);
    savedPrefsRef.current = seeded;
    setPrefs(seeded);
  };

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getSettings().then((read: SettingsRead) => {
      if (cancelled) return;
      const language = languageOf(read);
      applyLanguage(language);
      const stored = read.preferences ?? parsePreferences({});
      if (read.source === 'stored' && read.values) {
        savedRef.current = read.values;
        setValues(read.values);
        adoptPreferences(stored, read.values);
        setNote({ kind: 'key', key: 'settings.restored' });
        applyMotion(read.values.motion);
        onReadRef.current(read.values);
        return;
      }
      if (read.source === 'corrupt') {
        const fallback = { ...nonSecretDefaults, language: 'en' as const };
        savedRef.current = fallback;
        setValues(fallback);
        adoptPreferences(stored, fallback);
        setNote({ kind: 'key', key: 'settings.corrupt' });
        return;
      }
      savedRef.current = nonSecretDefaults;
      setValues(nonSecretDefaults);
      adoptPreferences(stored, nonSecretDefaults);
      setNote({ kind: 'key', key: 'settings.defaults' });
    }).catch(() => {
      if (!cancelled) setNote({ kind: 'key', key: 'settings.unread' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // File ▸ Settings, Assistant ▸ Assistant settings, Sync ▸ Sync settings and Mod+, open the window,
  // optionally on one section.
  const settingsRequest = useUiStore((state) => state.settingsRequest);
  useEffect(() => {
    if (!settingsRequest) return;
    if (settingsRequest.section) setSection(settingsRequest.section);
    setOpen(true);
  }, [settingsRequest]);

  // A note about the last save belongs to that visit; reopening shows the stored settings, not a stale "saved".
  useEffect(() => {
    if (open) setNote((current) => (current.kind === 'error' || current.key === 'settings.saved' || current.key === 'settings.saveFailed' ? { kind: 'key', key: 'settings.restored' } : current));
  }, [open]);

  // The menu or a canvas toggle saved a change: what is stored moved, so the form starts from it.
  useEffect(() => {
    const onChanged = (event: Event) => {
      const next = (event as CustomEvent<NonSecretSettings>).detail;
      if (!next) return;
      savedRef.current = next;
      setValues(next);
      adoptPreferences(usePreferencesStore.getState().preferences, next);
    };
    window.addEventListener(SETTINGS_CHANGED, onChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED, onChanged);
  }, []);

  const discard = () => {
    setValues(savedRef.current);
    setPrefs(savedPrefsRef.current);
    applyLanguage(savedRef.current.language);
    setPending(false);
  };
  const closeFromEscape = () => {
    discard();
    setOpen(false);
  };
  const closeFromEscapeRef = useRef(closeFromEscape);
  closeFromEscapeRef.current = closeFromEscape;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A shortcut being recorded owns Escape (it cancels the recording).
      if (document.querySelector('.settings-dialog [data-recording="true"]')) return;
      if (document.querySelector('.select-content[data-state="open"]')) {
        window.dispatchEvent(new Event(CLOSE_OPEN_SELECT));
        return;
      }
      if (!document.querySelector('.settings-dialog[data-state="open"]')) return;
      closeFromEscapeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const draftError = settingsWriteError(values) ?? preferencesWriteError(prefs);
  const dirty = !sameSettings(values, savedRef.current) || !samePreferences(prefs, savedPrefsRef.current);
  const saveDisabled = pending || !dirty || draftError !== null;
  const explained = draftError
    ? explainError(translate, draftError)
    : note.kind === 'error'
      ? explainError(translate, note.code)
      : null;
  const statusText = explained?.summary ?? translate(note.kind === 'key' ? note.key : 'settings.saveFailed');
  const invalidFields = draftError === 'Settings cannot store a secret' ? secretBearingFields(values) : [];
  const fieldError = (name: string): Record<string, string | boolean> => (
    invalidFields.includes(name)
      ? { 'aria-invalid': true, 'aria-describedby': 'settings-draft-error' }
      : {}
  );

  /**
   * After a save that set a new MCP address without choosing how to get in, ask the server and store its answer,
   * so a person who only pastes the address ends up with the right access. The dialog is closed by then: the
   * sentence comes as a toast, and SETTINGS_CHANGED brings the stored choice into the form.
   */
  const detectAccessAfterSave = async (stored: NonSecretSettings, storedPrefs: Preferences) => {
    try {
      const note = detectionNote(await window.electronAPI.mcpDetectAuth(stored.mcpUrl), translate);
      if (note.mode) {
        const again = await window.electronAPI.saveSettings({ ...stored, mcpAuth: note.mode, preferences: storedPrefs });
        if (!again.ok) return;
        window.dispatchEvent(new CustomEvent<NonSecretSettings>(SETTINGS_CHANGED, { detail: again.values }));
        refreshSyncStatus();
      }
      showToast({ id: 'mcp-access', tone: note.tone === 'good' ? 'success' : 'warn', title: note.text });
    } catch {
      // Nothing was chosen; "Check" in Settings ▸ Connection asks again.
    }
  };

  const save = async () => {
    if (saveDisabled) return;
    setPending(true);
    try {
      const result = await window.electronAPI.saveSettings({ ...values, preferences: prefs });
      if (!result.ok) {
        setNote({ kind: 'error', code: result.error });
        return;
      }
      // A new language reseeds the built-in knowledge in the main process; cached explanations follow it.
      if (savedRef.current.language !== result.values.language) void useKnowledgeStore.getState().reloadExplanations();
      const detect = shouldDetectAfterSave(savedRef.current, result.values);
      savedRef.current = result.values;
      setValues(result.values);
      const stored = result.preferences ?? prefs;
      savedPrefsRef.current = stored;
      setPrefs(stored);
      usePreferencesStore.getState().setPreferences(stored);
      setNote({ kind: 'key', key: 'settings.saved' });
      applyMotion(result.values.motion);
      applyLanguage(result.values.language);
      onSavedRef.current(result.values);
      setOpen(false);
      refreshSyncStatus();
      if (detect) void detectAccessAfterSave(result.values, stored);
    } catch {
      setNote({ kind: 'key', key: 'settings.saveFailed' });
    } finally {
      setPending(false);
    }
  };

  const draft: DraftProps = { values, setValues, saved: savedRef.current, prefs, setPrefs, container, fieldError, pending, dirty };
  const panelClass = cx(styles.panel, 'settings-panel');
  const panel = (id: SettingsSection, children: React.ReactNode) => (
    <TabsContent key={id} className={panelClass} value={id} tabIndex={-1} forceMount>
      {children}
    </TabsContent>
  );

  return (
    <DialogRoot
      modal
      open={open}
      onOpenChange={(next) => {
        if (!next) discard();
        setOpen(next);
        // The MCP token is held (or cleared) inside this dialog without a save; show its effect at once.
        if (!next) refreshSyncStatus();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" icon={triggerIcon}>{t('shell.settings')}</Button>}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          ref={setContainer}
          className={cx(styles.dialog, 'settings-dialog')}
          aria-describedby="settings-lead"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const active = document.querySelector('.settings-panel[data-state="active"]');
            const target = active?.querySelector<HTMLElement>('input:not([disabled]), [role="combobox"]')
              ?? active?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], button:not([disabled])')
              ?? document.querySelector<HTMLElement>('.settings-tab[data-state="active"]');
            target?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (document.querySelector('.settings-dialog [data-recording="true"]')) {
              event.preventDefault();
              return;
            }
            if (!document.querySelector('.select-content[data-state="open"]')) return;
            event.preventDefault();
            window.dispatchEvent(new Event(CLOSE_OPEN_SELECT));
          }}
          onPointerDownOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('.select-content')) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('.select-content')) event.preventDefault();
          }}
        >
          <header className={cx(styles.header, 'settings-header')}>
            <DialogTitle className={cx(styles.heading, 'settings-heading')}>{t('settings.title')}</DialogTitle>
            <DialogDescription id="settings-lead" className={cx(styles.lead, 'settings-lead')}>
              {t('settings.lead')}
            </DialogDescription>
          </header>
          <TabsRoot
            value={section}
            onValueChange={(next) => setSection(next as SettingsSection)}
            orientation="vertical"
            className={cx(styles.layout, 'settings-layout')}
          >
            <TabsList className={cx(styles.nav, 'settings-nav')} aria-label={String(t('settings.sections'))} tabIndex={-1}>
              {SETTINGS_SECTIONS.map((item) => {
                const Icon = SECTION_META[item].icon;
                return (
                  <TabsTrigger key={item} className={cx(styles.tab, 'settings-tab')} value={item} tabIndex={section === item ? 0 : -1}>
                    <Icon size={15} aria-hidden="true" className={styles.tabIcon} />
                    <span>{t(SECTION_META[item].labelKey)}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {panel('assistant', <AssistantSection {...draft} />)}
            {panel('models', <ModelsSection provider={values.provider} onSession={(source) => onSessionRef.current(source)} />)}
            {panel('connection', <ConnectionSection {...draft} />)}
            {panel('sync', (
              <>
                <SectionHead title={String(t('settings.sync'))} lead={String(t('preferences.lead.sync'))} />
                <SyncSection
                  fieldClass={fieldClass}
                  hintClass={hintClass}
                  rowClass={rowClass}
                  sync={prefs.sync}
                  container={container}
                  onSyncChange={(patch) => patchSection(setPrefs, 'sync', patch)}
                />
              </>
            ))}
            {panel('canvas', <CanvasSection {...draft} />)}
            {panel('appearance', <AppearanceSection {...draft} />)}
            {panel('shortcuts', <ShortcutsSection {...draft} />)}
            {panel('privacy', <PrivacySection {...draft} />)}
            {panel('about', <AboutSection />)}
          </TabsRoot>
          <footer className={cx(styles.actions, 'settings-actions')}>
            <div className={styles.footerText}>
              <p id="settings-draft-error" className={cx(styles.status, 'provider-note')} role="status">{statusText}</p>
              <p className={hintClass}>{t('settings.keyReason')}</p>
            </div>
            <div className={cx(rowClass, styles.footerButtons)}>
              <Button variant="primary" className={cx(styles.save, 'settings-save')} disabled={saveDisabled} onClick={() => void save()}>
                <span className={styles.saveReserve} aria-hidden="true">{t('settings.save')}</span>
                <span className="settings-save-current">{pending ? t('settings.saving') : t('settings.save')}</span>
              </Button>
              <DialogClose asChild>
                <Button>{t('settings.cancel')}</Button>
              </DialogClose>
            </div>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
