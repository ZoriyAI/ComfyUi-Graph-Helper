import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlugZap } from 'lucide-react';
import type { NonSecretSettings } from '../../../../shared/config/schema';
import { isPreferenceProvider, MODEL_SUGGESTIONS, STEP_LIMIT, type PreferenceProvider } from '../../../../shared/config/preferences';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge, { type BadgeTone } from '../../../ui/Badge';
import Button from '../../../ui/Button';
import NumberField from '../../../ui/NumberField';
import RadioCards from '../../../ui/RadioCards';
import SelectField from '../../../ui/SelectField';
import Switch from '../../../ui/Switch';
import { cx } from '../../../ui/cx';
import { providerKeyState, useProviderStore, type ProviderKeyState } from '../../../state/providerState';
import styles from '../SettingsPanel.module.css';
import { fieldClass, Group, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';

const PROVIDERS: Array<{ value: NonSecretSettings['provider']; labelKey: string; descriptionKey: string }> = [
  { value: '', labelKey: 'settings.providerNone', descriptionKey: 'preferences.providerDesc.none' },
  { value: 'openai', labelKey: 'settings.providerOpenAI', descriptionKey: 'preferences.providerDesc.openai' },
  { value: 'anthropic', labelKey: 'settings.providerAnthropic', descriptionKey: 'preferences.providerDesc.anthropic' },
  { value: 'google', labelKey: 'settings.providerGoogle', descriptionKey: 'preferences.providerDesc.google' },
  { value: 'local', labelKey: 'settings.providerLocal', descriptionKey: 'preferences.providerDesc.local' },
  { value: 'test', labelKey: 'settings.providerTest', descriptionKey: 'preferences.providerDesc.test' },
];

const KEY_TONES: Record<ProviderKeyState, BadgeTone> = { none: 'neutral', test: 'ai', ok: 'ok', session: 'accent', missing: 'warn' };

type ProbeNote = { kind: 'idle' } | { kind: 'running' } | { kind: 'ok'; ms: number } | { kind: 'failed'; error: string };

/** Settings ▸ Assistant: provider cards, model and base URL, Check connection, and how the helper behaves. */
export default function AssistantSection({ values, setValues, prefs, setPrefs, container, fieldError, pending }: DraftProps) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const keySource = useProviderStore((state) => state.keySource);
  const [probe, setProbe] = useState<ProbeNote>({ kind: 'idle' });
  const provider = values.provider;
  const remembered: PreferenceProvider | null = isPreferenceProvider(provider) ? provider : null;

  const chooseProvider = (next: string) => {
    const value = next as NonSecretSettings['provider'];
    setProbe({ kind: 'idle' });
    setValues((current) => {
      // A provider comes back with the model and base URL it had last; TEST and "none" keep the fields.
      if (!isPreferenceProvider(value)) return { ...current, provider: value };
      const entry = prefs.providers[value];
      return { ...current, provider: value, model: entry.model, baseURL: entry.baseURL };
    });
  };
  const setRuntime = (field: 'model' | 'baseURL', text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    if (remembered) {
      setPrefs((current) => ({ ...current, providers: { ...current.providers, [remembered]: { ...current.providers[remembered], [field]: text } } }));
    }
  };
  const checkConnection = async () => {
    setProbe({ kind: 'running' });
    try {
      const result = await window.electronAPI.llmProbe({ provider: values.provider, model: values.model, baseURL: values.baseURL });
      if (result.ok) setProbe({ kind: 'ok', ms: result.latencyMs });
      else {
        const explained = explainError(translate, result.error);
        setProbe({ kind: 'failed', error: explained.diagnostic ?? explained.summary });
      }
    } catch {
      setProbe({ kind: 'failed', error: String(t('errors.unknown')) });
    }
  };

  const providerHint = provider === 'local'
    ? String(t('settings.providerLocalHint'))
    : provider === 'openai' || provider === 'anthropic' || provider === 'google'
      ? String(t('settings.cloudBaseUrlHint'))
      : '';
  const assistant = prefs.assistant;
  const probeText = probe.kind === 'ok'
    ? String(t('preferences.checkOk', { ms: probe.ms }))
    : probe.kind === 'failed'
      ? String(t('preferences.checkFailed', { error: probe.error }))
      : '';

  return (
    <>
      <SectionHead title={String(t('settings.assistant'))} lead={String(t('preferences.lead.assistant'))} />
      <RadioCards
        label={String(t('settings.provider'))}
        value={provider}
        onChange={chooseProvider}
        columns={3}
        options={PROVIDERS.map((item) => {
          const state = providerKeyState(item.value, keySource);
          return {
            value: item.value,
            title: String(t(item.labelKey)),
            description: String(t(item.descriptionKey)),
            trailing: item.value === '' ? undefined : (
              <Badge tone={KEY_TONES[state]} className={styles.keyBadge}>
                <span className={cx(styles.keyDot, styles[`key-${state}`])} aria-hidden="true" />
                {t(`preferences.keyState.${state}`)}
              </Badge>
            ),
          };
        })}
      />
      {providerHint ? <p className={hintClass}>{providerHint}</p> : null}
      <label className={fieldClass}>
        {t('settings.model')}
        <input
          aria-label={String(t('settings.model'))}
          value={values.model}
          spellCheck={false}
          onChange={(event) => setRuntime('model', event.target.value)}
          {...fieldError('model')}
        />
      </label>
      {remembered ? (
        <div className={styles.suggestions}>
          <span className={hintClass}>{t('preferences.suggestions')}</span>
          <div className={styles.chips}>
            {MODEL_SUGGESTIONS[remembered].map((model) => (
              <button
                key={model}
                type="button"
                className={cx(styles.chip, values.model.trim() === model && styles.chipOn)}
                aria-label={String(t('preferences.useSuggestion', { model }))}
                aria-pressed={values.model.trim() === model}
                onClick={() => setRuntime('model', model)}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <label className={fieldClass}>
        {t('settings.baseUrl')}
        <input
          aria-label={String(t('settings.baseUrl'))}
          value={values.baseURL}
          spellCheck={false}
          onChange={(event) => setRuntime('baseURL', event.target.value)}
          {...fieldError('baseURL')}
        />
      </label>
      <p className={hintClass}>{t('settings.baseUrlHint')}</p>
      <div className={cx(rowClass, styles.rowStart)}>
        <Button
          size="sm"
          variant="subtle"
          icon={<PlugZap size={14} aria-hidden="true" />}
          loading={probe.kind === 'running'}
          disabled={pending || provider === '' || probe.kind === 'running'}
          onClick={() => void checkConnection()}
        >
          {probe.kind === 'running' ? t('preferences.checking') : t('preferences.check')}
        </Button>
        <span className={hintClass}>{t('preferences.checkHint')}</span>
      </div>
      {probeText ? <p className={cx(hintClass, probe.kind === 'ok' ? styles.good : styles.bad)} role="status">{probeText}</p> : null}

      <Group title={String(t('preferences.behaviour'))}>
        <SelectField
          label={String(t('preferences.defaultIntent'))}
          value={assistant.defaultIntent}
          options={[
            { value: 'ask', label: String(t('preferences.intentAsk')) },
            { value: 'build', label: String(t('preferences.intentBuild')) },
          ]}
          container={container}
          onChange={(next) => patchSection(setPrefs, 'assistant', { defaultIntent: next as 'ask' | 'build' })}
        />
        <p className={hintClass}>{t('preferences.defaultIntentHint')}</p>
        <NumberField
          label={String(t('preferences.maxSteps'))}
          value={assistant.maxStepsPerTurn}
          min={STEP_LIMIT.min}
          max={STEP_LIMIT.max}
          hint={String(t('preferences.maxStepsHint'))}
          decreaseLabel={String(t('preferences.decrease', { label: t('preferences.maxSteps') }))}
          increaseLabel={String(t('preferences.increase', { label: t('preferences.maxSteps') }))}
          onChange={(next) => patchSection(setPrefs, 'assistant', { maxStepsPerTurn: next })}
        />
        <Switch label={t('preferences.allowWebSearch')} checked={assistant.allowWebSearch} onCheckedChange={(next) => patchSection(setPrefs, 'assistant', { allowWebSearch: next })} />
        <Switch label={t('preferences.allowFetchPage')} checked={assistant.allowFetchPage} onCheckedChange={(next) => patchSection(setPrefs, 'assistant', { allowFetchPage: next })} />
        <p className={hintClass}>{t('preferences.webHint')}</p>
        <SelectField
          label={String(t('preferences.answerLanguage'))}
          value={assistant.answerLanguage}
          options={[
            { value: 'ui', label: String(t('preferences.answerUi')) },
            { value: 'en', label: String(t('preferences.answerEn')) },
            { value: 'ru', label: String(t('preferences.answerRu')) },
          ]}
          container={container}
          onChange={(next) => patchSection(setPrefs, 'assistant', { answerLanguage: next as 'ui' | 'en' | 'ru' })}
        />
        <SelectField
          label={String(t('preferences.verbosity'))}
          value={assistant.verbosity}
          options={[
            { value: 'short', label: String(t('preferences.verbosityShort')) },
            { value: 'normal', label: String(t('preferences.verbosityNormal')) },
          ]}
          container={container}
          onChange={(next) => patchSection(setPrefs, 'assistant', { verbosity: next as 'short' | 'normal' })}
        />
      </Group>
    </>
  );
}
