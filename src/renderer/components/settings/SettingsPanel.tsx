/**
 * The Settings (Preferences) dialog: it owns the draft of the non-secret settings row and the preferences, shows one
 * section at a time from ./sections, and saves them together. App.tsx renders it once behind the toolbar's gear;
 * the menu, Mod+, and other places open it through uiState's settingsRequest. Everything waits for Save so a person
 * can try values and walk away with Cancel; only keys and tokens are stored at once by their own buttons.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Info, Keyboard, LayoutGrid, Palette, Plug, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { settingsBaseline, settingsProblemFields, settingsWriteError, type SettingsField } from '../../../shared/config/draft';
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
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '../../ui/Dialog';
import Button from '../../ui/Button';
import Hint from '../../ui/Hint';
import { CLOSE_OPEN_SELECT } from '../../ui/SelectField';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import { cx } from '../../ui/cx';
import SyncSection from './SyncSection';
import AssistantSection from './sections/AssistantSection';
import { type KeySources } from '../../state/providerState';
import ConnectionSection from './sections/ConnectionSection';
import CanvasSection from './sections/CanvasSection';
import AppearanceSection from './sections/AppearanceSection';
import ShortcutsSection from './sections/ShortcutsSection';
import PrivacySection from './sections/PrivacySection';
import BrowserAccessSection from './sections/BrowserAccessSection';
import ServicesSection from './sections/ServicesSection';
import AboutSection from './sections/AboutSection';
import { fieldClass, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './sections/common';
import { SETTINGS_SECTIONS, useUiStore, type SettingsSection } from '../../state/uiState';
import { usePreferencesStore } from '../../state/preferencesState';
import { refreshSyncStatus, useKnowledgeStore } from '../../state/knowledgeState';
import { SETTINGS_CHANGED } from '../../commands/events';
import { showToast } from '../../ui/toastStore';
import { detectionNote, shouldDetectAfterSave } from './mcpAccess';
import ConfirmDialog from './sections/ConfirmDialog';
import { setAutoSync } from '../sync/SyncIndicator';
import { sameAuto, type AutoDraft } from './settingsDraft';
import styles from './SettingsPanel.module.css';

/** Puts the motion level on <html data-motion>, where motion/policy.ts and the stylesheets read it. */
function applyMotion(motion: NonSecretSettings['motion']) {
  document.documentElement.dataset.motion = motion;
}

/** Whether two settings rows are equal field by field; a new field in the schema must be added here too. */
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

/** The section that holds a field a save can fail on (the save opens it and the field takes focus). */
const FIELD_SECTION: Record<SettingsField, SettingsSection> = {
  mcpUrl: 'connection',
  comfyOrigin: 'connection',
  baseURL: 'assistant',
  model: 'assistant',
  other: 'assistant',
};

/** The label and icon of each section in the left list; the order comes from SETTINGS_SECTIONS. */
const SECTION_META: Record<SettingsSection, { labelKey: string; icon: LucideIcon }> = {
  services: { labelKey: 'services.title', icon: Plug },
  assistant: { labelKey: 'preferences.nav.assistant', icon: Bot },
  browserAccess: { labelKey: 'browser.title', icon: Plug },
  connection: { labelKey: 'preferences.nav.connection', icon: Plug },
  sync: { labelKey: 'preferences.nav.sync', icon: RefreshCw },
  canvas: { labelKey: 'preferences.nav.canvas', icon: LayoutGrid },
  appearance: { labelKey: 'preferences.nav.appearance', icon: Palette },
  shortcuts: { labelKey: 'preferences.nav.shortcuts', icon: Keyboard },
  privacy: { labelKey: 'preferences.nav.privacy', icon: ShieldCheck },
  about: { labelKey: 'preferences.nav.about', icon: Info },
};

/** The footer status line: a catalog key, or an error code from main that explainError turns into a sentence. */
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
 * keys and tokens go only to memory or OS storage through their own buttons. Auto sync is a draft too and is
 * applied on Save (settingsDraft.ts).
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
  onSession: (sources: KeySources) => void;
  triggerIcon?: React.ReactNode;
  /** The button that opens the dialog (focus returns to it). Defaults to a small "Settings" button. */
  trigger?: React.ReactElement;
}) {
  const { t } = useTranslation();
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 700px), (max-width: 1000px) and (pointer: coarse)').matches);
  useEffect(() => {
    const resized = () => setCompact(window.matchMedia('(max-width: 700px), (max-width: 1000px) and (pointer: coarse)').matches);
    window.addEventListener('resize', resized);
    return () => window.removeEventListener('resize', resized);
  }, []);
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const savedRef = useRef<NonSecretSettings>(nonSecretDefaults);
  const savedPrefsRef = useRef<Preferences>(parsePreferences({}));
  const onReadRef = useRef(onRead);
  const onSavedRef = useRef(onSaved);
  // The callbacks are read through refs so the load effect below runs once and still calls the latest props.
  onReadRef.current = onRead;
  onSavedRef.current = onSaved;
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('connection');
  const [values, setValues] = useState<NonSecretSettings>(nonSecretDefaults);
  const [prefs, setPrefs] = useState<Preferences>(() => parsePreferences({}));
  const [note, setNote] = useState<NoteState>({ kind: 'key', key: 'settings.notSavedYet' });
  const [pending, setPending] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // Settings ▸ Sync ▸ auto sync and its interval, as a draft like everything else here: null = unchanged.
  const [autoDraft, setAutoDraft] = useState<AutoDraft | null>(null);
  // Cancel or Escape with a changed draft asks first.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const syncAuto = useKnowledgeStore((state) => state.sync?.auto ?? null);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  const adoptPreferences = (stored: Preferences, row: NonSecretSettings) => {
    const seeded = seedProviders(row, stored);
    savedPrefsRef.current = seeded;
    setPrefs(seeded);
  };

  // Load the stored row once. A corrupt file falls back to the defaults (in the language shown) and says so in the
  // footer. A first start has no row: the form starts from the defaults in the system's language.
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
      const baseline = settingsBaseline(read, language);
      savedRef.current = baseline;
      setValues(baseline);
      adoptPreferences(stored, baseline);
      setNote({ kind: 'key', key: read.source === 'corrupt' ? 'settings.corrupt' : 'settings.defaults' });
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

  /** Throws the draft away; the language is put back too, since AppearanceSection applies it live for preview. */
  const discard = () => {
    setValues(savedRef.current);
    setPrefs(savedPrefsRef.current);
    setAutoDraft(null);
    applyLanguage(savedRef.current.language);
    setPending(false);
  };
  /** Closing (Cancel, Escape, the overlay): a changed draft is not thrown away without asking. */
  const requestClose = () => {
    if (dirtyRef.current) {
      setConfirmDiscard(true);
      return;
    }
    discard();
    setOpen(false);
    refreshSyncStatus();
  };
  const closeFromEscape = requestClose;
  // The window-level key listener is installed once, so it calls the latest close through a ref.
  const closeFromEscapeRef = useRef(closeFromEscape);
  closeFromEscapeRef.current = closeFromEscape;

  // Escape is handled in the capture phase, before the dialog sees it, so one press closes only the innermost thing:
  // a shortcut recording, then an open select, then the dialog itself (asking first about a changed draft).
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
      // The question about a changed draft owns Escape while it is open (Escape there keeps the draft).
      if (document.querySelector('.settings-discard[data-state="open"]')) return;
      closeFromEscapeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const draftError = settingsWriteError(values) ?? preferencesWriteError(prefs);
  const autoChanged = autoDraft !== null && syncAuto !== null && !sameAuto(autoDraft, syncAuto);
  const dirty = !sameSettings(values, savedRef.current) || !samePreferences(prefs, savedPrefsRef.current) || autoChanged;
  // requestClose is defined above and reads this ref, so it always sees the current draft state.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  // A draft that cannot be saved keeps Save pressable: pressing it opens the field to fix.
  const saveDisabled = pending || !dirty;
  const problems = draftError ? settingsProblemFields(values) : [];
  // A secret in a field has its own sentence (remove it); only a value the schema refuses names the field's fix.
  const firstProblem = draftError === 'Settings do not match the schema' ? problems[0] ?? null : null;
  const explained = draftError
    ? firstProblem && firstProblem !== 'other' ? null : explainError(translate, draftError)
    : note.kind === 'error'
      ? explainError(translate, note.code)
      : null;
  const statusText = firstProblem && firstProblem !== 'other'
    // A compatible service's address is an https address, not a server with a port.
    ? (firstProblem === 'baseURL' && values.provider === 'compatible' ? translate('settings.fixField.baseURLCompatible') : translate(`settings.fixField.${firstProblem}`))
    : explained?.summary ?? translate(note.kind === 'key' ? note.key : 'settings.saveFailed');
  const invalidFields: string[] = problems.filter((name) => name !== 'other');
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

  /** The field that keeps the draft from saving: its section opens and the field takes focus. */
  const showProblem = () => {
    const access = prefs.browserAccess;
    if (!Number.isInteger(access.port) || access.port < 1024 || access.port > 65535 || (access.enabled && !access.address)) {
      setSection('browserAccess'); setNote({ kind: 'key', key: 'browser.invalidConfig' });
      return;
    }
    const field = firstProblem ?? problems[0];
    if (!field) return;
    setSection(FIELD_SECTION[field]);
    // Wait for the tab switch to render the section before looking for the invalid field in it.
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('.settings-panel[data-state="active"] [aria-invalid="true"]')?.focus();
    }, 60);
  };

  const save = async () => {
    if (saveDisabled) return;
    if (draftError) {
      showProblem();
      return;
    }
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
      // Auto sync is applied with the rest; main keeps it off while there is no address to read.
      if (autoDraft && autoChanged) await setAutoSync(autoDraft.enabled, autoDraft.intervalMinutes);
      setAutoDraft(null);
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

  // Why Save is off, said in its tooltip: a field to fix, or nothing changed. While saving the button says so itself.
  const saveReason = pending ? '' : !dirty ? translate('settings.saveNothing') : '';
  const saveButton = (
    <Button variant="primary" className={cx(styles.save, 'settings-save')} disabled={saveDisabled} onClick={() => void save()}>
      <span className={styles.saveReserve} aria-hidden="true">{t('settings.save')}</span>
      <span className="settings-save-current">{pending ? t('settings.saving') : t('settings.save')}</span>
    </Button>
  );

  // The props every section gets: the draft, the saved row to compare against, and the portal container for popups.
  const draft: DraftProps = { values, setValues, saved: savedRef.current, prefs, setPrefs, container, fieldError, pending, dirty };
  const panelClass = cx(styles.panel, 'settings-panel');
  const panel = (id: SettingsSection, children: React.ReactNode) => (
    // forceMount keeps every section mounted, so field state and focus targets survive switching sections.
    <TabsContent key={id} className={panelClass} value={id} tabIndex={-1} forceMount>
      {children}
    </TabsContent>
  );

  return (
    <DialogRoot
      modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          requestClose();
          return;
        }
        setOpen(true);
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
            // Focus the first useful control of the open section rather than the dialog's first button.
            event.preventDefault();
            const active = document.querySelector('.settings-panel[data-state="active"]');
            const target = active?.querySelector<HTMLElement>('input:not([disabled]), [role="combobox"], [role="radio"][tabindex="0"]')
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
          // Select popups are portalled outside the dialog; a click in one must not count as a click outside.
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
              {t(section === 'services' ? 'services.actionsNow' : 'settings.lead')}
            </DialogDescription>
          </header>
          <TabsRoot
            value={section}
            onValueChange={(next) => setSection(next as SettingsSection)}
            orientation={compact ? 'horizontal' : 'vertical'}
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
            {panel('assistant', <AssistantSection {...draft} active={open && section === 'assistant'} onSession={(sources) => onSessionRef.current(sources)} />)}
            {panel('services', <ServicesSection active={open && section === 'services'} />)}
            {panel('connection', <ConnectionSection {...draft} />)}
            {panel('browserAccess', <BrowserAccessSection {...draft} />)}
            {panel('sync', (
              <>
                <SectionHead title={String(t('settings.sync'))} lead={String(t('preferences.lead.sync'))} />
                <SyncSection
                  autoDraft={autoDraft}
                  onAutoDraft={setAutoDraft}
                  addressSet={values.mcpUrl.trim() !== '' || values.comfyOrigin.trim() !== ''}
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
            </div>
            <div className={cx(rowClass, styles.footerButtons)}>
              <Hint label={saveDisabled ? saveReason : ''} side="top">{saveButton}</Hint>
              <Button variant="subtle" onClick={requestClose}>{t('settings.cancel')}</Button>
            </div>
          </footer>
          <ConfirmDialog
            className="settings-discard"
            open={confirmDiscard}
            onOpenChange={setConfirmDiscard}
            title={translate('settings.discardTitle')}
            lead={translate('settings.discardLead')}
            confirmLabel={translate('settings.discardConfirm')}
            cancelLabel={translate('settings.discardKeep')}
            onConfirm={() => {
              discard();
              setOpen(false);
              refreshSyncStatus();
            }}
          />
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
