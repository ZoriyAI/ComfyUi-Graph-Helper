import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';
import { consumeSecretSave } from './secretSave';
import { applyMotion } from '../../ui/policy';
import { Button } from '../../ui/Button';

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
          <section className="settings-section">
            <h3>Connection</h3>
            <label>
              Comfy origin
              <input
                aria-label="Comfy origin"
                value={values.comfyOrigin}
                onChange={(event) => setValues({ ...values, comfyOrigin: event.target.value })}
              />
            </label>
            <label>
              Model
              <input
                aria-label="Model"
                value={values.model}
                onChange={(event) => setValues({ ...values, model: event.target.value })}
              />
            </label>
          </section>
          <section className="settings-section">
            <h3>Motion</h3>
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
            <Button variant="primary" onClick={() => { void save(); }}>
              Save settings
            </Button>
            <p className="provider-note">{settingsNote}</p>
          </section>
          <section className="settings-section">
            <h3>Key</h3>
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
            <Button onClick={() => { void saveKey(); }}>
              Save key
            </Button>
            <p className="provider-note">{secretNote}</p>
          </section>
          <div className="settings-actions">
            <Button onClick={() => dialogRef.current?.close()}>
              Close
            </Button>
          </div>
        </form>
      </dialog>
  );

  return (
    <>
      <Button ref={openerRef} variant="primary" onClick={() => dialogRef.current?.showModal()}>
        Settings
      </Button>
      {createPortal(dialog, document.body)}
    </>
  );
}
