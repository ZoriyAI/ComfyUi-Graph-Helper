import React, { useEffect, useState } from 'react';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';

export default function SettingsPanel() {
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
      setValues(read.values);
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
      setValues(result.values);
      setSettingsNote('Non-secret settings saved.');
    } catch {
      setSettingsNote('Settings could not be saved.');
    }
  };

  const saveKey = async () => {
    try {
      const result = await window.electronAPI.saveSecret(secret);
      setSecret('');
      setSecretNote(result.status === 'secret-storage-blocked'
        ? 'secret-storage-blocked. The key was not written.'
        : 'The key was not written.');
    } catch {
      setSecret('');
      setSecretNote('The key was not written.');
    }
  };

  return (
    <section className="settings-strip" aria-label="Settings">
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
      <label>
        Motion
        <select
          aria-label="Motion"
          value={values.motion}
          onChange={(event) => setValues({ ...values, motion: event.target.value as NonSecretSettings['motion'] })}
        >
          <option value="system">System</option>
          <option value="on">On</option>
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
    </section>
  );
}
