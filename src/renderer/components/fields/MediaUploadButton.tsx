/** The loader's native/browser file chooser. Only a completed upload commits a filename to the original field. */
import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MEDIA_UPLOAD_MAX_BYTES } from '../../../shared/contracts/media';
import { captureEditOrigin, requireEditOrigin, type EditOrigin } from '../graph/lib/editOrigin';
import type { FieldControlProps } from './FieldControl';
import styles from './FieldControl.module.css';

/** Selection comes from this device's disk, including a phone. No local path is sent to ComfyUI. */
export default function MediaUploadButton({ value, spec, disabled, onCommit }: FieldControlProps) {
  const { t } = useTranslation();
  const picker = useRef<HTMLInputElement>(null);
  const origin = useRef<{ at: EditOrigin; value: unknown } | null>(null);
  const current = useRef({ value, disabled, onCommit });
  current.current = { value, disabled, onCommit };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A successful change from another paired device also clears this field's previous upload error.
  useEffect(() => setError(null), [value]);
  const accept = spec?.fileUpload === 'file' ? undefined : `${spec?.fileUpload ?? 'image'}/*`;
  const changed = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    const started = origin.current;
    if (!file || !started || current.current.disabled || !requireEditOrigin(started.at)) return;
    if (file.size > MEDIA_UPLOAD_MAX_BYTES) { setError('large'); return; }
    setBusy(true); setError(null);
    try {
      const data = await file.arrayBuffer();
      if (!requireEditOrigin(started.at) || current.current.value !== started.value || current.current.disabled) { setError('changed'); return; }
      const result = await window.electronAPI.uploadNodeFile(file.name, data);
      if (!result.ok) { setError(result.error); return; }
      if (!requireEditOrigin(started.at) || current.current.value !== started.value || current.current.disabled) { setError('changed'); return; }
      current.current.onCommit(result.name);
    } catch { setError('failed'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <input ref={picker} type="file" accept={accept} hidden onChange={(event) => void changed(event)} />
      <button type="button" className={styles.uploadButton} disabled={disabled || busy} title={String(t('field.uploadHint'))} onClick={() => {
        origin.current = { at: captureEditOrigin(), value: current.current.value };
        setError(null); picker.current?.click();
      }}>
        <Upload size={12} aria-hidden="true" />{busy ? t('field.uploading') : t('field.chooseFile')}
      </button>
      {error ? <span className={styles.uploadError} role="alert">{t(`field.uploadError.${error}`)}</span> : null}
    </>
  );
}
