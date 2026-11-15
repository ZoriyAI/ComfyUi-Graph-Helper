/**
 * The advice blocks of Settings > Assistant (AssistantSection renders them): which cloud model to take and what it
 * costs, which local models call tools, and how to give a local server a larger context window. The facts come from
 * shared/config/modelAdvice so they are dated and kept in one place.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import IconButton from '../../../ui/IconButton';
import Button from '../../../ui/Button';
import { ADVICE_DATE, CLOUD_ADVICE, LOCAL_ADVICE, LOCAL_INSTALL_PAGE, LOCAL_WINDOW_ADVICE, priceOf, type AdviceProvider } from '../../../../shared/config/modelAdvice';
import styles from './ProviderAdvice.module.css';

/** An address shown as words with a copy button: the app opens no browser by itself. */
export function AddressLine({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <div className={styles.address} data-address={url}>
      <span>{label}:</span>
      <span className={styles.url}>{url}</span>
      <IconButton size="sm" label={String(t(copied ? 'providers.copied' : 'providers.copyAddress'))} onClick={copy}>
        <Copy size={13} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

/** A price in US dollars in the interface's number format; cents only for prices under one dollar. */
function money(value: number, language: string): string {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 2 : 0 }).format(value);
}

/**
 * Settings ▸ Assistant, under a cloud company's card: which model to take (a cheap one and a stronger one, with
 * their prices on the date of the list), that cloud requests cost money, where to get a key and where the
 * company's data rules are.
 */
export function CloudAdvice({ provider }: { provider: AdviceProvider }) {
  const { t, i18n } = useTranslation();
  const advice = CLOUD_ADVICE[provider];
  const price = (model: string) => {
    const found = priceOf(provider, model);
    return found ? String(t('providers.pricePair', { input: money(found.input, i18n.language), output: money(found.output, i18n.language) })) : '';
  };
  return (
    <div className={`${styles.block} provider-advice`} data-provider={provider}>
      <p className={styles.title}>{t('providers.whichModel')}</p>
      <p className={styles.line}>{t('providers.cheapModel', { model: advice.cheap, price: price(advice.cheap) })}</p>
      <p className={styles.line}>{t('providers.strongModel', { model: advice.strong, price: price(advice.strong) })}</p>
      <p className={styles.line}>{t('providers.costs', { date: ADVICE_DATE })}</p>
      <AddressLine label={String(t('providers.keyPage'))} url={advice.keyPage} />
      <AddressLine label={String(t('providers.dataPolicy'))} url={advice.dataPolicy} />
    </div>
  );
}

/** Settings ▸ Assistant, under "Own server": the local models that call tools, the memory they need, the window. */
export function LocalAdvice() {
  const { t } = useTranslation();
  return (
    <div className={`${styles.block} provider-advice`} data-provider="local">
      <p className={styles.title}>{t('providers.whichModel')}</p>
      <p className={styles.line}>{t('providers.localLead', { window: LOCAL_WINDOW_ADVICE })}</p>
      <ul className={styles.list}>
        {LOCAL_ADVICE.map((item) => (
          <li key={item.model}>{t('providers.localModel', { model: item.model, memory: item.memoryGb })}</li>
        ))}
      </ul>
      <p className={styles.line}>{t('providers.localFree')}</p>
      <p className={styles.line}>{t('providers.localCloudNames')}</p>
      <AddressLine label={String(t('providers.localInstall'))} url={LOCAL_INSTALL_PAGE} />
      <p className={styles.line}>{t('providers.localPull')}</p>
      <pre className={styles.command}>{`ollama pull ${LOCAL_ADVICE[0].model}`}</pre>
    </div>
  );
}

/**
 * Under the window note when your own server loads the model with too small a window: for Ollama a button that
 * makes a copy of the model with a larger window (Ollama's own interface, on the person's click), and in every
 * case how to set the window by hand for the ways a server is usually run.
 */
export function WindowHelp({ onVariant, busy, note }: { onVariant: (() => void) | null; busy: boolean; note: string }) {
  const { t } = useTranslation();
  // The usual ways to run a local server, each with a sentence and, where there is one, a command to copy.
  const ways: Array<{ text: string; command?: string }> = [
    { text: 'providers.windowService', command: 'sudo systemctl edit ollama.service' },
    { text: 'providers.windowServiceLines', command: `[Service]\nEnvironment="OLLAMA_CONTEXT_LENGTH=${LOCAL_WINDOW_ADVICE}"` },
    { text: 'providers.windowServiceRestart', command: 'sudo systemctl daemon-reload && sudo systemctl restart ollama' },
    { text: 'providers.windowDocker', command: `-e OLLAMA_CONTEXT_LENGTH=${LOCAL_WINDOW_ADVICE}` },
    { text: 'providers.windowOther' },
    { text: 'providers.windowLmStudio' },
    { text: 'providers.windowLlamaCpp', command: `llama-server -m model.gguf -c ${LOCAL_WINDOW_ADVICE} --jinja` },
  ];
  return (
    <div className={`${styles.block} window-help`}>
      {onVariant ? (
        <>
          <p className={styles.line}>{t('providers.variantLead', { window: LOCAL_WINDOW_ADVICE })}</p>
          <div>
            <Button size="sm" variant="subtle" loading={busy} disabled={busy} onClick={onVariant}>
              {t('providers.variantButton', { window: LOCAL_WINDOW_ADVICE })}
            </Button>
          </div>
        </>
      ) : null}
      {note ? <p className={styles.line} role="status">{note}</p> : null}
      <p className={styles.title}>{t('providers.windowHowTitle')}</p>
      {ways.map((way) => (
        <React.Fragment key={way.text}>
          <p className={styles.line}>{t(way.text, { window: LOCAL_WINDOW_ADVICE })}</p>
          {way.command ? <pre className={styles.command}>{way.command}</pre> : null}
        </React.Fragment>
      ))}
      <p className={styles.line}>{t('providers.windowMemory')}</p>
    </div>
  );
}
