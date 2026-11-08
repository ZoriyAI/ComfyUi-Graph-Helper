import React, { useEffect, useRef, useState } from 'react';
import { settingsWriteError } from '../../../shared/config/draft';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';
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
import SelectField, { CLOSE_OPEN_SELECT } from '../../ui/SelectField';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';

function applyMotion(motion: NonSecretSettings['motion']) {
  document.documentElement.dataset.motion = motion;
}

function sameSettings(left: NonSecretSettings, right: NonSecretSettings) {
  return left.theme === right.theme
    && left.motion === right.motion
    && left.provider === right.provider
    && left.model === right.model
    && left.baseURL === right.baseURL
    && left.comfyOrigin === right.comfyOrigin;
}

const PROVIDERS = [
  { value: '', label: 'Not configured' },
  { value: 'test', label: 'TEST fixture' },
  { value: 'openai', label: 'OpenAI' },
];

const MOTION = [
  { value: 'system', label: 'System' },
  { value: 'on', label: 'On' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'off', label: 'Off' },
];

const KEY_REASON = 'Key storage is not available. The key is not written. Cancel does not store a key.';

type Section = 'connection' | 'assistant' | 'appearance';

export default function SettingsPanel({
  onRead,
  onSaved,
}: {
  onRead: (values: NonSecretSettings) => void;
  onSaved: (values: NonSecretSettings) => void;
}) {
  const savedRef = useRef<NonSecretSettings>(nonSecretDefaults);
  const onReadRef = useRef(onRead);
  const onSavedRef = useRef(onSaved);
  onReadRef.current = onRead;
  onSavedRef.current = onSaved;
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>('connection');
  const [values, setValues] = useState<NonSecretSettings>(nonSecretDefaults);
  const [settingsNote, setSettingsNote] = useState('Settings are not saved yet.');
  const [pending, setPending] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getSettings().then((read: SettingsRead) => {
      if (cancelled) return;
      if (read.source === 'stored' && read.values) {
        savedRef.current = read.values;
        setValues(read.values);
        setSettingsNote('Restored non-secret settings.');
        applyMotion(read.values.motion);
        onReadRef.current(read.values);
        return;
      }
      if (read.source === 'corrupt') {
        setSettingsNote('Stored settings could not be read. Defaults are shown and are not written yet.');
        return;
      }
      setSettingsNote('Defaults are shown and are not written yet.');
    }).catch(() => {
      if (!cancelled) setSettingsNote('Settings could not be read.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const discard = () => {
    setValues(savedRef.current);
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

  const draftError = settingsWriteError(values);
  const dirty = !sameSettings(values, savedRef.current);
  const saveDisabled = pending || !dirty || draftError !== null;
  const note = draftError ?? settingsNote;

  const save = async () => {
    if (saveDisabled) return;
    setPending(true);
    try {
      const result = await window.electronAPI.saveSettings(values);
      if (!result.ok) {
        setSettingsNote(result.error);
        return;
      }
      savedRef.current = result.values;
      setValues(result.values);
      setSettingsNote('Non-secret settings saved.');
      applyMotion(result.values.motion);
      onSavedRef.current(result.values);
      setOpen(false);
    } catch {
      setSettingsNote('Settings could not be saved.');
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogRoot
      modal
      open={open}
      onOpenChange={(next) => {
        if (!next) discard();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="ghost-button">Settings</button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="dialog-overlay" />
        <DialogContent
          ref={setContainer}
          className="settings-dialog"
          aria-describedby="settings-lead"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const panel = document.querySelector('.settings-panel[data-state="active"]');
            panel?.querySelector<HTMLElement>('input:not([disabled]), [role="combobox"]')?.focus();
          }}
          onEscapeKeyDown={(event) => {
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
          <header className="settings-header">
            <DialogTitle className="settings-heading">Settings</DialogTitle>
            <DialogDescription id="settings-lead" className="settings-lead">
              Non-secret preferences. A section change does not write.
            </DialogDescription>
          </header>
          <TabsRoot
            value={section}
            onValueChange={(next) => setSection(next as Section)}
            orientation="vertical"
            className="settings-layout"
          >
            <TabsList className="settings-nav" aria-label="Settings sections" tabIndex={-1}>
              <TabsTrigger className="settings-tab" value="connection" tabIndex={section === 'connection' ? 0 : -1}>Connection</TabsTrigger>
              <TabsTrigger className="settings-tab" value="assistant" tabIndex={section === 'assistant' ? 0 : -1}>Assistant</TabsTrigger>
              <TabsTrigger className="settings-tab" value="appearance" tabIndex={section === 'appearance' ? 0 : -1}>Appearance & Motion</TabsTrigger>
            </TabsList>
            <TabsContent className="settings-panel" value="connection" tabIndex={-1}>
              <h3>Connection</h3>
              <label className="field">
                Comfy origin
                <input
                  aria-label="Comfy origin"
                  value={values.comfyOrigin}
                  onChange={(event) => setValues((current) => ({ ...current, comfyOrigin: event.target.value }))}
                />
              </label>
              <p className="field-hint">Used only as a label. This build does not connect or queue.</p>
              <label className="field">
                API key
                <input
                  type="password"
                  aria-label="API key"
                  aria-describedby="key-unavailable"
                  value=""
                  disabled
                  readOnly
                />
              </label>
              <p id="key-unavailable" className="field-hint">{KEY_REASON}</p>
              <button type="button" className="ghost-button" disabled>
                Save key
              </button>
            </TabsContent>
            <TabsContent className="settings-panel" value="assistant" tabIndex={-1}>
              <h3>Assistant</h3>
              <SelectField
                label="Provider"
                value={values.provider}
                options={PROVIDERS}
                container={container}
                onChange={(provider) => setValues((current) => ({ ...current, provider: provider as NonSecretSettings['provider'] }))}
              />
              <label className="field">
                Model
                <input
                  aria-label="Model"
                  value={values.model}
                  onChange={(event) => setValues((current) => ({ ...current, model: event.target.value }))}
                />
              </label>
              <label className="field">
                Base URL
                <input
                  aria-label="Base URL"
                  value={values.baseURL}
                  onChange={(event) => setValues((current) => ({ ...current, baseURL: event.target.value }))}
                />
              </label>
              <p className="field-hint">An http(s) origin, or empty. A secret in any field blocks the save.</p>
            </TabsContent>
            <TabsContent className="settings-panel" value="appearance" tabIndex={-1}>
              <h3>Appearance & Motion</h3>
              <SelectField
                label="Motion"
                value={values.motion}
                options={MOTION}
                container={container}
                onChange={(motion) => setValues((current) => ({ ...current, motion: motion as NonSecretSettings['motion'] }))}
              />
              <p className="field-hint">System, On, Reduced, or Off. The choice applies after Save, not while drafting.</p>
            </TabsContent>
          </TabsRoot>
          <footer className="settings-actions">
            <p className="provider-note" role="status">{note}</p>
            <p className="field-hint">{KEY_REASON}</p>
            <div className="settings-buttons">
              <button type="button" className="send-button" disabled={saveDisabled} onClick={() => void save()}>
                {pending ? 'Saving…' : 'Save settings'}
              </button>
              <DialogClose className="ghost-button">Cancel</DialogClose>
            </div>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
