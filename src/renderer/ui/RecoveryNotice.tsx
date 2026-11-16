/** Keeps recoverable loading and saving failures visible with a direct retry action. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import styles from './RecoveryNotice.module.css';

/** Recoverable errors stay next to the affected work, with one concrete retry action. */
export default function RecoveryNotice({ kind, retry, saving = false, loading = false }: {
  kind: 'project' | 'history' | 'messages' | 'lessons' | 'progress';
  retry?: () => void; saving?: boolean; loading?: boolean;
}) {
  const { t } = useTranslation();
  return <div className={styles.notice} role={loading ? 'status' : 'alert'}>
    <p>{t(loading ? 'recovery.loading' : `recovery.${kind}`)}</p>
    {!loading && retry ? <Button size="sm" onClick={retry}>{t(saving ? 'recovery.retrySave' : 'recovery.retryLoad')}</Button> : null}
  </div>;
}
