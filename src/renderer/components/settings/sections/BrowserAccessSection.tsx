/** Optional access from another device; fields save with Settings, pairing and revocation act immediately. */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import type { BrowserAccessStatus } from '../../../../shared/browser/contracts';
import Switch from '../../../ui/Switch';
import SelectField from '../../../ui/SelectField';
import Button from '../../../ui/Button';
import { isBrowserClient } from '../../../browser/bridge';
import { fieldClass, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';
import styles from '../SettingsPanel.module.css';

/** Display only the actual listening URL and a code explicitly requested on this computer. */
export default function BrowserAccessSection({ prefs, setPrefs, container }: DraftProps) {
  const { t } = useTranslation(); const [status, setStatus] = useState<BrowserAccessStatus | null>(null); const [qr, setQr] = useState(''); const [error, setError] = useState(false); const [copied, setCopied] = useState(false);
  const browser = isBrowserClient();
  useEffect(() => {
    if (browser) return;
    let disposed = false;
    const refresh = () => { void window.electronAPI.browserAccessStatus().then((value) => { if (!disposed) { setStatus(value); setError(false); } }).catch(() => { if (!disposed) setError(true); }); };
    refresh(); const timer = setInterval(refresh, 1500);
    return () => { disposed = true; clearInterval(timer); };
  }, [browser]);
  useEffect(() => {
    let disposed = false; setQr('');
    if (status?.url) void QRCode.toDataURL(status.url, { width: 180, margin: 4, errorCorrectionLevel: 'M' }).then((url) => { if (!disposed) setQr(url); }).catch(() => undefined);
    return () => { disposed = true; };
  }, [status?.url]);
  const set = (patch: Partial<typeof prefs.browserAccess>) => patchSection(setPrefs, 'browserAccess', patch);
  const connect = async () => {
    try { const pairing = await window.electronAPI.browserPairingCode(); setStatus((current) => current ? { ...current, pairing } : current); setError(false); }
    catch { setError(true); }
  };
  const copy = async () => {
    if (!status?.url) return;
    try { await navigator.clipboard.writeText(status.url); setCopied(true); }
    catch { setCopied(false); }
  };
  if (browser) return <><SectionHead title={String(t('browser.title'))} /><p className={hintClass}>{t('browser.onComputer')}</p></>;
  const stateText = error ? t('browser.requestFailed') : status?.state === 'error' ? t(status.error === 'port-in-use' ? 'browser.portInUse' : status.error === 'address-unavailable' ? 'browser.addressUnavailable' : 'browser.startFailed') : status?.state === 'listening' ? t('browser.listening') : status?.state === 'starting' ? t('browser.starting') : t('browser.off');
  return <>
    <SectionHead title={String(t('browser.title'))} lead={String(t('browser.lead'))} />
    <Switch label={t('browser.enabled')} checked={prefs.browserAccess.enabled} onCheckedChange={(enabled) => set({ enabled, address: prefs.browserAccess.address || status?.addresses[0]?.address || '' })} />
    <SelectField label={String(t('browser.address'))} value={prefs.browserAccess.address} options={(status?.addresses ?? []).map((item) => ({ value: item.address, label: `${item.name} · ${item.address}` }))} onChange={(address) => set({ address })} container={container} />
    <label className={fieldClass}>{t('browser.port')}<input type="number" min={1024} max={65535} inputMode="numeric" aria-invalid={!Number.isInteger(prefs.browserAccess.port) || prefs.browserAccess.port < 1024 || prefs.browserAccess.port > 65535} value={prefs.browserAccess.port} onChange={(event) => set({ port: Number(event.target.value) })} /></label>
    <p className={hintClass}>{t('browser.saveHint')}</p><p className={hintClass}>{t('browser.trustedWifi')}</p>
    <p role="status" data-testid="browser-access-status">{stateText}</p>
    {status?.url ? <section className={styles.browserConnection}>
      <p><a data-testid="browser-access-url" href={status.url} target="_blank" rel="noreferrer">{status.url}</a></p>
      <div className={rowClass}><Button onClick={() => void copy()}>{t(copied ? 'browser.copied' : 'browser.copy')}</Button><Button onClick={() => void connect()}>{t('browser.pairDevice')}</Button></div>
      {qr ? <img width={180} height={180} src={qr} alt={String(t('browser.qr'))} /> : null}
      {status.pairing ? <p className={styles.pairCode}><span>{t('browser.codeLabel')}</span><strong data-testid="browser-pair-code">{status.pairing.code}</strong><span className={hintClass}>{t('browser.codeExpiry')}</span></p> : null}
    </section> : null}
    <h4>{t('browser.devices')}</h4>
    {status?.devices.length ? <ul className={styles.browserDevices}>{status.devices.map((device) => <li key={device.id}><span>{device.name}</span><Button onClick={() => { void window.electronAPI.browserRevoke(device.id).then(() => window.electronAPI.browserAccessStatus()).then(setStatus).catch(() => setError(true)); }}>{t('browser.disconnect')}</Button></li>)}</ul> : <p className={hintClass}>{t('browser.noDevices')}</p>}
    <p className={hintClass}>{t('browser.networkHint')}</p>
  </>;
}
