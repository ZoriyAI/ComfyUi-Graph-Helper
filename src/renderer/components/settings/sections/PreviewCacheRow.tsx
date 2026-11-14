import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import { formatBytes } from '../../library/libraryModel';
import styles from '../SettingsPanel.module.css';
import { hintClass, rowClass } from './common';

/**
 * Settings ▸ Privacy ▸ the picture cache: how much of the models' preview pictures and clips the app keeps on the
 * disk, and a button that empties it. The cache also empties itself when the server address changes.
 */
export default function PreviewCacheRow() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const [size, setSize] = useState<{ files: number; bytes: number } | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    void window.electronAPI.previewCacheSize().then(setSize).catch(() => undefined);
  }, []);
  const clear = async () => {
    const cleared = await window.electronAPI.clearPreviewCache().catch(() => null);
    if (!cleared) return;
    setSize({ files: 0, bytes: 0 });
    setNote(String(t('preferences.previewCacheCleared', { files: cleared.files, size: formatBytes(cleared.bytes, language) })));
  };
  return (
    <>
      <div className={cx(rowClass, styles.rowStart)}>
        <Button size="sm" variant="subtle" className="clear-previews" disabled={!size || size.files === 0} icon={<ImageOff size={14} aria-hidden="true" />} onClick={() => void clear()}>
          {t('preferences.previewCacheClear')}
        </Button>
      </div>
      <p className={hintClass}>
        {size && size.files > 0
          ? t('preferences.previewCacheHint', { files: size.files, size: formatBytes(size.bytes, language) })
          : t('preferences.previewCacheEmpty')}
      </p>
      {note ? <p className={hintClass} role="status">{note}</p> : null}
    </>
  );
}
