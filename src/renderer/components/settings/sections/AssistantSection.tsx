import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlugZap, Radar, RefreshCw } from 'lucide-react';
import type { LocalServer, ModelChoice } from '../../../../shared/contracts/pickers';
import type { NonSecretSettings } from '../../../../shared/config/schema';
import { CONTEXT_TOKENS, isPreferenceProvider, MODEL_SUGGESTIONS, STEP_LIMIT, type PreferenceProvider } from '../../../../shared/config/preferences';
import { contextWindowFor } from '../../../../shared/agent/contextWindow';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP, megabytes } from '../../../../shared/agent/limits';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge, { type BadgeTone } from '../../../ui/Badge';
import Button from '../../../ui/Button';
import NumberField from '../../../ui/NumberField';
import RadioCards from '../../../ui/RadioCards';
import SelectField from '../../../ui/SelectField';
import SuggestField, { type SuggestStatus } from '../../../ui/SuggestField';
import Switch from '../../../ui/Switch';
import { cx } from '../../../ui/cx';
import { providerKeyState, useProviderStore, type ProviderKeyState } from '../../../state/providerState';
import styles from '../SettingsPanel.module.css';
import { fieldClass, Group, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';
import { listable, modelSuggestions, serverFor, serverSuggestions, withKnownFacts } from './pickerItems';

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

type ModelList = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; models: ModelChoice[]; source: string } | { kind: 'failed'; error: string };
type Discovery = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; servers: LocalServer[]; notes: string[] };

/** Typing in the base URL asks again after a short pause, not on every key. */
const LIST_DEBOUNCE_MS = 450;

/** Settings ▸ Assistant: provider cards, model and base URL, Check connection, and how the helper behaves. */
export default function AssistantSection({ values, setValues, prefs, setPrefs, container, fieldError, pending }: DraftProps) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const keySource = useProviderStore((state) => state.keySource);
  const [probe, setProbe] = useState<ProbeNote>({ kind: 'idle' });
  const [modelList, setModelList] = useState<ModelList>({ kind: 'idle' });
  const [listTick, setListTick] = useState(0);
  const [discovery, setDiscovery] = useState<Discovery>({ kind: 'idle' });
  const listRequest = useRef(0);
  const discoveryStarted = useRef(false);
  const provider = values.provider;
  const remembered: PreferenceProvider | null = isPreferenceProvider(provider) ? provider : null;
  const errorText = (code: string) => {
    const explained = explainError(translate, code);
    return explained.diagnostic ?? explained.summary;
  };

  // The model list follows the provider, the base URL and the key: whenever one changes, the list is read again.
  useEffect(() => {
    const ticket = ++listRequest.current;
    if (!listable(provider, values.baseURL)) {
      setModelList({ kind: 'idle' });
      return undefined;
    }
    const timer = setTimeout(() => {
      setModelList({ kind: 'loading' });
      window.electronAPI.llmListModels({ provider, baseURL: values.baseURL })
        .then((result) => {
          if (ticket !== listRequest.current) return;
          setModelList(result.ok ? { kind: 'ok', models: result.models, source: result.source } : { kind: 'failed', error: result.error });
        })
        .catch(() => {
          if (ticket === listRequest.current) setModelList({ kind: 'failed', error: 'The model list could not be read.' });
        });
    }, LIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [provider, values.baseURL, keySource, listTick]);

  const findServers = () => {
    discoveryStarted.current = true;
    setDiscovery({ kind: 'loading' });
    window.electronAPI.llmDiscoverLocal()
      .then((found) => setDiscovery({ kind: 'done', servers: found.servers, notes: found.notes }))
      .catch(() => setDiscovery({ kind: 'done', servers: [], notes: [] }));
  };
  // A local provider looks for servers once by itself, so the list is there when the section opens.
  useEffect(() => {
    if (provider === 'local' && !discoveryStarted.current) findServers();
  }, [provider]);

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
  const chosenWindow = contextWindowFor(values.model, assistant.contextTokens);
  const autoWindow = contextWindowFor(values.model, 0);
  const contextHint = String(t('preferences.contextTokensHint', {
    tokens: assistant.contextTokens > 0 ? chosenWindow.tokens : autoWindow.tokens,
    model: values.model || '—',
    source: t(chosenWindow.source === 'override' ? 'preferences.contextSourceOverride' : chosenWindow.source === 'known' ? 'preferences.contextSourceKnown' : 'preferences.contextSourceDefault'),
  }));
  const servers = discovery.kind === 'done' ? discovery.servers : [];
  const known = provider === 'local' ? serverFor(servers, values.baseURL)?.models : undefined;
  const models = modelList.kind === 'ok' ? withKnownFacts(modelList.models, known) : [];
  const chosenModel = models.find((model) => model.id === values.model.trim());
  const modelStatus: SuggestStatus | null = modelList.kind === 'loading'
    ? { text: String(t('picker.modelsLoading')) }
    : modelList.kind === 'ok'
      ? models.length > 0
        ? { text: String(t('picker.modelsFound', { count: models.length, source: modelList.source })), tone: 'good' }
        : { text: String(t('picker.modelsNone', { source: modelList.source })) }
      : modelList.kind === 'failed'
        ? { text: String(t('picker.modelsFailed', { error: errorText(modelList.error) })), tone: 'bad' }
        : provider === 'local'
          ? { text: String(t('picker.modelsNeedServer')) }
          : null;
  const discoveryStatus: SuggestStatus | null = discovery.kind === 'loading'
    ? { text: String(t('picker.serversLoading')) }
    : discovery.kind === 'done'
      ? {
        text: [
          String(servers.length > 0 ? t('picker.serversFound', { count: servers.length }) : t('picker.serversNone')),
          ...discovery.notes.map((note) => String(t('picker.serversNote', { note: errorText(note) }))),
        ].join(' '),
        tone: servers.length > 0 ? 'good' : 'neutral',
      }
      : null;
  // Picking a server fills the address (the model list follows) and, while no model is chosen, its default model.
  const pickServer = (value: string) => {
    setRuntime('baseURL', value);
    const server = serverFor(servers, value);
    if (server?.defaultModel && values.model.trim() === '') setRuntime('model', server.defaultModel);
  };
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
      {provider === 'local' ? (
        <SuggestField
          className={fieldClass}
          label={String(t('settings.baseUrl'))}
          value={values.baseURL}
          onChange={(text) => setRuntime('baseURL', text)}
          onPick={pickServer}
          inputProps={fieldError('baseURL')}
          suggestions={serverSuggestions(servers, translate)}
          pickerLabel={String(t('picker.serverList'))}
          placeholder={String(t('picker.serverPlaceholder', { count: servers.length }))}
          emptyText={String(t('picker.serverEmpty'))}
          action={{ label: String(t('picker.findServers')), onClick: findServers, loading: discovery.kind === 'loading', disabled: pending, icon: <Radar size={14} aria-hidden="true" /> }}
          status={discoveryStatus}
          container={container}
        />
      ) : null}
      {provider === 'local' ? <p className={hintClass}>{t('settings.baseUrlHint')}</p> : null}
      <SuggestField
        className={fieldClass}
        label={String(t('settings.model'))}
        value={values.model}
        onChange={(text) => setRuntime('model', text)}
        inputProps={fieldError('model')}
        suggestions={modelSuggestions(models, translate)}
        pickerLabel={String(t('picker.modelList'))}
        placeholder={String(t('picker.modelPlaceholder', { count: models.length }))}
        emptyText={String(t('picker.modelEmpty'))}
        action={listable(provider, values.baseURL) ? {
          label: String(t('picker.refreshModels')),
          onClick: () => setListTick((tick) => tick + 1),
          loading: modelList.kind === 'loading',
          disabled: pending,
          icon: <RefreshCw size={14} aria-hidden="true" />,
        } : undefined}
        status={modelStatus}
        container={container}
      />
      {chosenModel?.tools === false ? <p className={styles.errorNote} role="alert">{t('picker.modelsNoTools')}</p> : null}
      {remembered && !(modelList.kind === 'ok' && models.length > 0) ? (
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
      {provider !== 'local' ? (
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
      ) : null}
      {provider !== 'local' ? <p className={hintClass}>{t('settings.baseUrlHint')}</p> : null}
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
        <NumberField
          label={String(t('preferences.contextTokens'))}
          value={assistant.contextTokens}
          min={CONTEXT_TOKENS.min}
          max={CONTEXT_TOKENS.max}
          step={CONTEXT_TOKENS.step}
          hint={contextHint}
          decreaseLabel={String(t('preferences.decrease', { label: t('preferences.contextTokens') }))}
          increaseLabel={String(t('preferences.increase', { label: t('preferences.contextTokens') }))}
          onChange={(next) => patchSection(setPrefs, 'assistant', { contextTokens: next })}
        />
        <Switch label={t('preferences.allowWebSearch')} checked={assistant.allowWebSearch} onCheckedChange={(next) => patchSection(setPrefs, 'assistant', { allowWebSearch: next })} />
        <Switch label={t('preferences.allowFetchPage')} checked={assistant.allowFetchPage} onCheckedChange={(next) => patchSection(setPrefs, 'assistant', { allowFetchPage: next })} />
        <p className={hintClass}>{t('preferences.webHint')}</p>
        <p className={cx(hintClass, 'web-limits')}>{t('preferences.webLimits', { bytes: megabytes(FETCH_PAGE_BYTE_CAP), chars: FETCH_PAGE_TEXT_CAP })}</p>
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
