import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';
import SelectField from '../../ui/SelectField';
import { consumeSecretSave } from './secretSave';

function applyMotion(motion: NonSecretSettings['motion']) {
  document.documentElement.dataset.motion = motion;
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

export default function SettingsPanel({
  onRead,
  onSaved,
}: {
  onRead: (values: NonSecretSettings) => void;
  onSaved: (values: NonSecretSettings) => void;
}) {
  const openerRef = useRef<HTMLButtonElement>(null);
  const savedRef = useRef<NonSecretSettings>(nonSecretDefaults);
  const onReadRef = useRef(onRead);
  const onSavedRef = useRef(onSaved);
  onReadRef.current = onRead;
  onSavedRef.current = onSaved;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<NonSecretSettings>(nonSecretDefaults);
  const [settingsNote, setSettingsNote] = useState('Settings are not saved yet.');
  const [secret, setSecret] = useState('');
  const [secretNote, setSecretNote] = useState('Key storage is not available.');

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const frame = requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.settings-dialog input')?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      openerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getSettings().then((read: SettingsRead) => {
      if (cancelled) return;
      if (read.source === 'corrupt') {
        setSettingsNote('Stored settings are corrupt and were left unchanged.');
        return;
      }
      savedRef.current = read.values;
      setValues(read.values);
      applyMotion(read.values.motion);
      setSettingsNote(read.source === 'stored' ? 'Restored non-secret settings.' : 'Defaults are shown and are not written yet.');
      onReadRef.current(read.values);
    }).catch(() => {
      if (!cancelled) setSettingsNote('Settings could not be read.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const discard = () => {
    setValues(savedRef.current);
    setOpen(false);
  };

  const save = async () => {
    try {
      const result = await window.electronAPI.saveSettings(values);
      if (!result.ok) {
        setSettingsNote(result.error);
        return;
      }
      savedRef.current = result.values;
      setValues(result.values);
      applyMotion(result.values.motion);
      setSettingsNote('Non-secret settings saved.');
      onSavedRef.current(result.values);
    } catch {
      setSettingsNote('Settings could not be saved.');
    }
  };

  const saveKey = async () => {
    const outcome = await consumeSecretSave(
      (value) => window.electronAPI.saveSecret(value),
      secret,
    );
    setSecret(outcome.secret);
    setSecretNote(outcome.note);
  };

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={(next) => { if (!next) discard(); else setOpen(true); }}>
      <Dialog.Trigger asChild>
        <button ref={openerRef} type="button" className="ghost-button">Settings</button>
      </Dialog.Trigger>
      <Dialog.Portal forceMount>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="settings-dialog settings-strip"
          aria-describedby="settings-lead"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('.select-content')) event.preventDefault();
          }}
        >
          <header className="settings-header">
            <Dialog.Title className="settings-heading">Settings</Dialog.Title>
            <p id="settings-lead" className="settings-lead">Connection, assistant, and motion. Nothing here starts a ComfyUI queue.</p>
          </header>
          <div className="settings-body">
            <section className="settings-section" aria-label="Connection">
              <h3>Connection</h3>
              <label className="field">
                Comfy origin
                <input
                  aria-label="Comfy origin"
                  value={values.comfyOrigin}
                  onChange={(event) => setValues({ ...values, comfyOrigin: event.target.value })}
                />
              </label>
              <p className="field-hint">Live queue and generation stay off in this build.</p>
            </section>
            <section className="settings-section" aria-label="Assistant">
              <h3>Assistant</h3>
              <SelectField
                label="Provider"
                value={values.provider}
                options={PROVIDERS}
                onChange={(provider) => setValues({ ...values, provider: provider as NonSecretSettings['provider'] })}
              />
              <label className="field">
                Model
                <input
                  aria-label="Model"
                  autoComplete="off"
                  value={values.model}
                  onChange={(event) => setValues({ ...values, model: event.target.value })}
                />
              </label>
              <label className="field">
                Base URL
                <input
                  aria-label="Base URL"
                  autoComplete="off"
                  spellCheck={false}
                  value={values.baseURL}
                  onChange={(event) => setValues({ ...values, baseURL: event.target.value })}
                />
              </label>
              <p className="provider-note">{settingsNote}</p>
              <label className="field">
                API key
                <input
                  type="password"
                  aria-label="API key"
                  autoComplete="off"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                />
              </label>
              <p className="field-hint">Key storage is not available. The key is not written. Cancel does not store a key.</p>
              <button type="button" className="ghost-button" onClick={() => { void saveKey(); }}>
                Save key
              </button>
              <p className="provider-note">{secretNote}</p>
            </section>
            <section className="settings-section" aria-label="Appearance and motion">
              <h3>Appearance and motion</h3>
              <SelectField
                label="Motion"
                value={values.motion}
                options={MOTION}
                onChange={(motion) => setValues({ ...values, motion: motion as NonSecretSettings['motion'] })}
              />
              <p className="field-hint">System follows the operating system. On, Reduced, and Off apply after Save settings. Dark is the only theme.</p>
            </section>
          </div>
          <footer className="settings-actions">
            <button type="button" className="ghost-button" onClick={() => { void save(); }}>
              Save settings
            </button>
            <Dialog.Close asChild>
              <button type="button" className="ghost-button">Close</button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
