import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';
import { consumeSecretSave } from './secretSave';

function applyMotion(motion: NonSecretSettings['motion']) {
  document.documentElement.dataset.motion = motion;
}

export default function SettingsPanel() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const savedRef = useRef<NonSecretSettings>(nonSecretDefaults);
  const [values, setValues] = useState<NonSecretSettings>(nonSecretDefaults);
  const [settingsNote, setSettingsNote] = useState('Settings are not saved yet.');
  const [secret, setSecret] = useState('');
  const [secretNote, setSecretNote] = useState('Key storage is not available.');

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
    }).catch(() => {
      if (!cancelled) setSettingsNote('Settings could not be read.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const dialog = (
      <dialog
        ref={dialogRef}
        className="settings-dialog"
        aria-label="Settings"
        onClose={() => {
          setValues(savedRef.current);
          openerRef.current?.focus();
        }}
      >
        <form className="settings-strip" onSubmit={(event) => event.preventDefault()}>
          <h2 className="settings-heading">Settings</h2>
          <p className="settings-lead">Project connection and motion. Nothing here starts a ComfyUI queue.</p>
          <label>
            Comfy origin
            <input
              aria-label="Comfy origin"
              value={values.comfyOrigin}
              onChange={(event) => setValues({ ...values, comfyOrigin: event.target.value })}
            />
          </label>
          <label>
            Provider
            <select
              aria-label="Provider"
              value={values.provider}
              onChange={(event) => setValues({ ...values, provider: event.target.value as NonSecretSettings['provider'] })}
            >
              <option value="">Not configured</option>
              <option value="test">TEST fixture</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label>
            Model
            <input
              aria-label="Model"
              autoComplete="off"
              value={values.model}
              onChange={(event) => setValues({ ...values, model: event.target.value })}
            />
          </label>
          <label>
            Base URL
            <input
              aria-label="Base URL"
              autoComplete="off"
              spellCheck={false}
              value={values.baseURL}
              onChange={(event) => setValues({ ...values, baseURL: event.target.value })}
            />
          </label>
          <label>
            Motion
            <select
              aria-label="Motion"
              value={values.motion}
              onChange={(event) => setValues({ ...values, motion: event.target.value as NonSecretSettings['motion'] })}
            >
              <option value="system">System</option>
              <option value="on">On</option>
              <option value="reduced">Reduced</option>
              <option value="off">Off</option>
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={() => { void save(); }}>
            Save settings
          </button>
          <p className="provider-note">{settingsNote}</p>
          <label>
            API key
            <input
              type="password"
              aria-label="API key"
              autoComplete="off"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </label>
          <button type="button" className="ghost-button" onClick={() => { void saveKey(); }}>
            Save key
          </button>
          <p className="provider-note">{secretNote}</p>
          <div className="settings-actions">
            <button type="button" className="ghost-button" onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </div>
        </form>
      </dialog>
  );

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className="ghost-button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Settings
      </button>
      {createPortal(dialog, document.body)}
    </>
  );
}
