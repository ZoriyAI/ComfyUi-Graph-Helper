import React from 'react';
import { useTranslation } from 'react-i18next';
import { version as packageVersion } from '../../../../../package.json';
import styles from '../SettingsPanel.module.css';
import { hintClass, SectionHead } from './common';

/** Settings ▸ About: name, version, runtime versions, licences. */
export default function AboutSection() {
  const { t } = useTranslation();
  const versions = window.electronAPI?.versions;
  const version = versions?.app || packageVersion;
  return (
    <>
      <SectionHead title={String(t('preferences.nav.about'))} />
      <div className={styles.about}>
        <span className={styles.aboutMark} aria-hidden="true" />
        <div>
          <p className={styles.aboutName}>{t('shell.title')}</p>
          <p className={hintClass}>{t('preferences.aboutVersion', { version })}</p>
        </div>
      </div>
      <p className={hintClass}>{t('preferences.lead.about')}</p>
      {versions ? <p className={hintClass}>{t('preferences.aboutRuntime', { electron: versions.electron, chrome: versions.chrome, node: versions.node })}</p> : null}
      <p className={hintClass}>{t('preferences.aboutLicence')}</p>
      <p className={hintClass}>{t('preferences.aboutData')}</p>
    </>
  );
}
