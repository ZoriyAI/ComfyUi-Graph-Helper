import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import Button from '../../ui/Button';
import { showToast } from '../../ui/Toast';
import { writeClipboard } from '../../services/diagnostics/diagnostics';
import type { AboutInfo, ThirdPartyComponent } from '../../../shared/contracts/about';
import { version as packageVersion } from '../../../../package.json';
import iconUrl from '../../../../resources/icon.png';
import styles from './AboutContent.module.css';
import { openProjectLink } from '../../services/help';
import { useUiStore } from '../../state/uiState';

type View = 'main' | 'licence' | 'components';

/** The text "Copy details" puts on the clipboard: what a bug report needs, nothing private. */
export function aboutDetailsText(name: string, info: AboutInfo): string {
  return [
    `${name} ${info.version}`,
    `Electron ${info.electron}`,
    `Chromium ${info.chrome}`,
    `Node ${info.node}`,
    info.system,
  ].join('\n');
}

/**
 * Help ▸ About and Settings ▸ About show this one view: the app's icon, name and version, what it is, its licence,
 * the components that ship with it, a "copy details" for bug reports and the data folder. `renderTitle` lets the
 * dialog give the name its accessible title element.
 */
export default function AboutContent({ renderTitle }: { renderTitle?: (text: string, className: string) => React.ReactNode }) {
  const { t } = useTranslation();
  const api = window.electronAPI;
  const [view, setView] = useState<View>('main');
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [licence, setLicence] = useState<string | null>(null);
  const [components, setComponents] = useState<ThirdPartyComponent[] | null>(null);
  const name = String(t('shell.title'));
  const version = info?.version || api?.versions?.app || packageVersion;

  useEffect(() => {
    let alive = true;
    void api?.aboutInfo?.().then((value) => { if (alive) setInfo(value); }).catch(() => undefined);
    return () => { alive = false; };
  }, [api]);

  const openLicence = () => {
    setView('licence');
    if (licence === null) void api?.aboutLicence?.().then(setLicence).catch(() => setLicence(''));
  };
  const openComponents = () => {
    setView('components');
    if (components === null) void api?.aboutNotices?.().then(setComponents).catch(() => setComponents([]));
  };
  const copyDetails = async () => {
    const text = info ? aboutDetailsText(name, info) : `${name} ${version}`;
    const copied = await writeClipboard(text);
    if (copied) showToast({ id: 'about-details', tone: 'success', title: String(t('appInfo.copied')), description: String(t('appInfo.copiedHint')), duration: 5000 });
    else showToast({ id: 'about-details', tone: 'error', title: String(t('appInfo.copyFailed')) });
  };
  const openData = async () => {
    const result = await api?.openDataFolder?.().catch(() => ({ ok: false as const, error: 'failed' }));
    if (!result || !result.ok) showToast({ id: 'about-data', tone: 'error', title: String(t('appInfo.openDataFailed')) });
  };
  const openChromium = async () => {
    const result = await api?.openChromiumLicences?.().catch(() => ({ ok: false as const, error: 'failed' }));
    if (!result || !result.ok) showToast({ id: 'about-chromium', tone: 'error', title: String(t('appInfo.chromiumFailed')) });
  };

  if (view === 'licence') {
    return (
      <div className={styles.sub} data-about-view="licence">
        <div className={styles.subHead}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => setView('main')}>{t('appInfo.back')}</Button>
          <p className={styles.subTitle}>{t('appInfo.licenceTitle')}</p>
        </div>
        <p className={styles.note} data-about-commercial>
          {t('appInfo.commercial')} {t('appInfo.commercialContact')}
        </p>
        <pre className={styles.text} tabIndex={0}>{licence ?? ''}</pre>
      </div>
    );
  }

  if (view === 'components') {
    return (
      <div className={styles.sub} data-about-view="components">
        <div className={styles.subHead}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => setView('main')}>{t('appInfo.back')}</Button>
          <p className={styles.subTitle}>{t('appInfo.components')}</p>
        </div>
        <p className={styles.note}>{t('appInfo.componentsLead')} {t('appInfo.canvasCredit')}</p>
        {info?.chromiumLicences ? (
          <div className={styles.chromium}>
            <span className={styles.note}>{t('appInfo.chromiumHint')}</span>
            <Button variant="ghost" size="sm" onClick={() => void openChromium()}>{t('appInfo.chromium')}</Button>
          </div>
        ) : null}
        <ul className={styles.list} tabIndex={0} data-about-components>
          {components === null ? null : components.length === 0 ? <li className={styles.note}>{t('appInfo.noNotices')}</li> : components.map((item) => (
            <li key={`${item.name}@${item.version}`} className={styles.item}>
              <details>
                <summary className={styles.summary}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemMeta}>{item.version} · {item.license}</span>
                </summary>
                <pre className={styles.itemText}>{item.text}</pre>
              </details>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.main} data-about-view="main">
      <img className={styles.icon} src={iconUrl} width={64} height={64} alt="" aria-hidden="true" />
      {renderTitle ? renderTitle(name, styles.name) : <p className={styles.name}>{name}</p>}
      <p className={styles.version} data-about-version>{t('appInfo.version', { version })}</p>
      <p className={styles.lead}>{t('appInfo.independent', { name })}</p>
      <p className={styles.lead}>{t('appInfo.lead')}</p>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={openLicence}>{t('appInfo.licence')}</Button>
        <Button variant="ghost" size="sm" onClick={openComponents}>{t('appInfo.components')}</Button>
        <Button variant="ghost" size="sm" onClick={() => void copyDetails()}>{t('appInfo.copyInfo')}</Button>
        <Button variant="ghost" size="sm" onClick={() => void openData()}>{t('appInfo.openData')}</Button>
      </div>
      {/* The project's pages; greyed out while this build has no project address (identity.ts PROJECT_URL). */}
      <div className={styles.actions} data-about-project>
        <Button variant="ghost" size="sm" disabled={!info?.projectLinks} title={info?.projectLinks ? undefined : String(t('projectLinks.unavailable'))} onClick={() => void openProjectLink('site')}>{t('projectLinks.site')}</Button>
        <Button variant="ghost" size="sm" disabled={!info?.projectLinks} title={info?.projectLinks ? undefined : String(t('projectLinks.unavailable'))} onClick={() => useUiStore.getState().setDialog('report-problem')}>{t('projectLinks.report')}</Button>
        <Button variant="ghost" size="sm" disabled={!info?.projectLinks} title={info?.projectLinks ? undefined : String(t('projectLinks.unavailable'))} onClick={() => void openProjectLink('releases')}>{t('projectLinks.releases')}</Button>
      </div>
      <details className={styles.details}>
        <summary className={styles.detailsSummary}>{t('appInfo.details')}</summary>
        <div className={styles.detailsBody}>
          {info ? <p>{t('appInfo.runtime', { electron: info.electron, chrome: info.chrome, node: info.node })}</p> : null}
          {info ? <p>{t('appInfo.system', { system: info.system })}</p> : null}
          {info ? <p className={styles.path}>{t('appInfo.dataFolder', { path: info.dataFolder })}</p> : null}
          <p>{t('preferences.aboutLicence')}</p>
          <p>{t('preferences.aboutData')}</p>
        </div>
      </details>
    </div>
  );
}
