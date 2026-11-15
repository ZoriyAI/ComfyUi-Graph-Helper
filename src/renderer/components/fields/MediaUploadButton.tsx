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
  const rememberOrigin = () => {
    origin.current = { at: captureEditOrigin(), value: current.current.value };
    setError(null);
  };
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
      <label role="button" tabIndex={disabled || busy ? -1 : 0} aria-disabled={disabled || busy} className={`${styles.uploadButton} nodrag nopan`} title={String(t('field.uploadHint'))} onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !disabled && !busy) {
          event.preventDefault(); rememberOrigin(); picker.current?.click();
        }
      }}>
        {/* The tap lands on the native input itself. Mobile pickers need trusted user activation, including Safari. */}
        <input ref={picker} className={styles.nativePicker} type="file" accept={accept} tabIndex={-1} disabled={disabled || busy}
          aria-label={String(t('field.chooseFile'))} onClickCapture={rememberOrigin} onChange={(event) => void changed(event)} />
        <Upload size={12} aria-hidden="true" />{busy ? t('field.uploading') : t('field.chooseFile')}
      </label>
      {error ? <span className={styles.uploadError} role="alert">{t(`field.uploadError.${error}`)}</span> : null}
    </>
  );
}
