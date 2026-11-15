/**
 * Settings > Assistant, the first section of SettingsPanel: the provider cards, the provider's key (KeyPanel), the
 * model and address with live pickers, Test connection, the context window advice, the helper's behaviour and the
 * network proxy. Provider, model and address are fields of the settings row; each provider also remembers its last
 * model and address in preferences.providers, so switching back restores them. Keys apply at once in main.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMPACT_WINDOW, MIN_WORKING_WINDOW, RECOMMENDED_WINDOW } from '../../../../shared/agent/contextWindow';
import { PlugZap, Radar, RefreshCw } from 'lucide-react';
import type { LocalServer, ModelChoice } from '../../../../shared/contracts/pickers';
import type { NonSecretSettings } from '../../../../shared/config/schema';
import { CONTEXT_TOKENS, isPreferenceProvider, MODEL_SUGGESTIONS, STEP_LIMIT, type PreferenceProvider } from '../../../../shared/config/preferences';
import { effectiveContextWindow } from '../../../../shared/agent/contextWindow';
import { contextSourceKey } from './pickerItems';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP } from '../../../../shared/agent/limits';
import { formatMegabytes } from '../../../../shared/i18n/format';
import { isAppLanguage } from '../../../../shared/i18n/languages';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge, { type BadgeTone } from '../../../ui/Badge';
import Button from '../../../ui/Button';
import NumberField from '../../../ui/NumberField';
import RadioCards from '../../../ui/RadioCards';
import SelectField from '../../../ui/SelectField';
import SuggestField, { type SuggestStatus } from '../../../ui/SuggestField';
import Switch from '../../../ui/Switch';
import { cx } from '../../../ui/cx';
import { CLOUD_PROVIDERS, keySourceOf, providerKeyState, useProviderStore, type KeySources, type ProviderKeyState, testProviderOffered } from '../../../state/providerState';
import type { CloudKeyProvider } from '../../../../shared/contracts';
import KeyPanel from './KeyPanel';
import { CloudAdvice, LocalAdvice, WindowHelp } from './ProviderAdvice';
import { CLOUD_ADVICE } from '../../../../shared/config/modelAdvice';
import { proxyAddressValid } from '../../../../shared/config/proxy';
import styles from '../SettingsPanel.module.css';
import { fieldClass, Group, hintClass, patchSection, rowClass, SectionHead, type DraftProps } from './common';
import { discoveryEmptyNoteShown, listable, modelSuggestions, onlyModelToPick, serverFor, serverSuggestions, withKnownFacts } from './pickerItems';

/** The provider cards in order; the scripted test provider is only offered in unpackaged runs and tests. */
const PROVIDERS: Array<{ value: NonSecretSettings['provider']; labelKey: string; descriptionKey: string }> = [
  { value: '', labelKey: 'settings.providerNone', descriptionKey: 'preferences.providerDesc.none' },
  { value: 'openai', labelKey: 'settings.providerOpenAI', descriptionKey: 'preferences.providerDesc.openai' },
  { value: 'anthropic', labelKey: 'settings.providerAnthropic', descriptionKey: 'preferences.providerDesc.anthropic' },
  { value: 'google', labelKey: 'settings.providerGoogle', descriptionKey: 'preferences.providerDesc.google' },
  { value: 'compatible', labelKey: 'settings.providerCompatible', descriptionKey: 'preferences.providerDesc.compatible' },
  { value: 'local', labelKey: 'settings.providerLocal', descriptionKey: 'preferences.providerDesc.local' },
  { value: 'test', labelKey: 'settings.providerTest', descriptionKey: 'preferences.providerDesc.test' },
];

/** The badge colour of each key state on a provider card. */
const KEY_TONES: Record<ProviderKeyState, BadgeTone> = { none: 'neutral', test: 'ai', ok: 'ok', session: 'accent', missing: 'warn', setup: 'neutral' };

/** The state of Test connection: idle, running, or its result (latency and the window the server reported). */
type ProbeNote = { kind: 'idle' } | { kind: 'running' } | { kind: 'ok'; ms: number; contextTokens: number | null } | { kind: 'failed'; error: string };

/** The live model list of the chosen provider, and the local servers that discovery found. */
type ModelList = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; models: ModelChoice[]; source: string } | { kind: 'failed'; error: string };
type Discovery = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; servers: LocalServer[]; notes: string[] };

/** Main's sentence for a cloud provider without a key: here the field to paste it is right above. */
const NO_KEY = 'Cloud model has no key for this session.';

/** The host of a compatible service's https address, or null while the address is not one. */
export function compatibleHost(baseURL: string): string | null {
  try {
    const url = new URL(baseURL.trim());
    return url.protocol === 'https:' && url.hostname !== '' ? url.host : null;
  } catch {
    return null;
  }
}

/** Typing in the base URL asks again after a short pause, not on every key. */
const LIST_DEBOUNCE_MS = 450;

/** Settings ▸ Assistant: provider cards, model and base URL, Test connection, and how the helper behaves. */
export default function AssistantSection({ values, setValues, prefs, setPrefs, container, fieldError, pending, onSession }: DraftProps & { onSession: (sources: KeySources) => void }) {
  const { t, i18n } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  // Each card shows its own provider's key; a key held for one provider says nothing about another.
  const keySources = useProviderStore((state) => state.keySources);
  const [probe, setProbe] = useState<ProbeNote>({ kind: 'idle' });
  const [modelList, setModelList] = useState<ModelList>({ kind: 'idle' });
  const [listTick, setListTick] = useState(0);
  const [discovery, setDiscovery] = useState<Discovery>({ kind: 'idle' });
  const [variant, setVariant] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' });
  // Each list request takes a new ticket; an answer for an older ticket is ignored.
  const listRequest = useRef(0);
  // The list callback reads the current model through this ref, not the value captured when the request started.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  // Discovery runs by itself only once while the section is mounted; after that only the Find button runs it.
  const discoveryStarted = useRef(false);
  const provider = values.provider;
  const remembered: PreferenceProvider | null = isPreferenceProvider(provider) ? provider : null;
  // The longer diagnostic when there is one: the section has room for it, unlike a toast.
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
          // `127.0.0.1:11434/v1` answered as http://…: the field takes the address that worked.
          if (result.completedUrl && provider === 'local') setRuntime('baseURL', result.completedUrl);
          // The server lists exactly one model and none is chosen: it is the one.
          const only = result.ok && provider === 'local' ? onlyModelToPick(result.models, valuesRef.current.model) : null;
          if (only) setRuntime('model', only);
        })
        .catch(() => {
          if (ticket === listRequest.current) setModelList({ kind: 'failed', error: 'The model list could not be read.' });
        });
    }, LIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  // listTick is bumped by the refresh button; the key source is a dependency so a pasted key lists again.
  }, [provider, values.baseURL, keySourceOf(keySources, provider), listTick]);

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
  /** Sets the model or address in the draft row and in the provider's remembered entry together. */
  const setRuntime = (field: 'model' | 'baseURL', text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    if (remembered) {
      setPrefs((current) => ({ ...current, providers: { ...current.providers, [remembered]: { ...current.providers[remembered], [field]: text } } }));
    }
  };
  // Ollama makes a copy of the model that loads with a larger window; the copy is chosen in its place.
  const makeVariant = async () => {
    setVariant({ busy: true, note: '' });
    try {
      const result = await window.electronAPI.llmOllamaWindow({ provider: values.provider, model: values.model, baseURL: values.baseURL }, RECOMMENDED_WINDOW);
      if (result.ok) {
        setRuntime('model', result.model);
        setProbe({ kind: 'idle' });
        setVariant({ busy: false, note: String(t('providers.variantMade', { model: result.model })) });
      } else {
        setVariant({ busy: false, note: errorText(result.error) });
      }
    } catch {
      setVariant({ busy: false, note: String(t('errors.unknown')) });
    }
  };
  const checkConnection = async () => {
    setProbe({ kind: 'running' });
    try {
      const result = await window.electronAPI.llmProbe({ provider: values.provider, model: values.model, baseURL: values.baseURL });
      if (result.ok) setProbe({ kind: 'ok', ms: result.latencyMs, contextTokens: result.contextTokens ?? null });
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
    : provider === 'compatible'
      ? String(t('providers.compatibleHint'))
      : provider === 'openai' || provider === 'anthropic' || provider === 'google'
      ? String(t('settings.cloudHint', { provider: provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google' }))
      : '';
  const assistant = prefs.assistant;
  // The window the server reported on "Test connection" is the "auto" value, the same number the helper uses.
  const serverWindow = probe.kind === 'ok' ? probe.contextTokens : null;

  const servers = discovery.kind === 'done' ? discovery.servers : [];
  const known = provider === 'local' ? serverFor(servers, values.baseURL)?.models : undefined;
  const models = modelList.kind === 'ok' ? withKnownFacts(modelList.models, known) : [];
  const chosenModel = models.find((model) => model.id === values.model.trim());
  // The model's own window from its list entry counts as known, the same number a turn uses.
  const listedWindow = chosenModel?.contextLength ?? null;
  const chosenWindow = effectiveContextWindow(values.model, assistant.contextTokens, serverWindow, listedWindow);
  // The window "auto" (0) gives; the hint names it while no fixed value is set.
  const autoWindow = effectiveContextWindow(values.model, 0, serverWindow, listedWindow);
  const contextHint = String(t('preferences.contextTokensHint', {
    tokens: assistant.contextTokens > 0 ? chosenWindow.tokens : autoWindow.tokens,
    model: values.model || '—',
    source: t(contextSourceKey(chosenWindow.source)),
  }));

  const modelStatus: SuggestStatus | null = modelList.kind === 'loading'
    ? { text: String(t('picker.modelsLoading')) }
    : modelList.kind === 'ok'
      ? models.length > 0
        ? { text: String(t('picker.modelsFound', { count: models.length, source: modelList.source })), tone: 'good' }
        : { text: String(t('picker.modelsNone', { source: modelList.source })) }
      : modelList.kind === 'failed'
        ? { text: modelList.error === NO_KEY ? String(t('providers.pasteKeyAbove')) : String(t('picker.modelsFailed', { error: errorText(modelList.error) })), tone: 'bad' }
        : provider === 'local'
          ? { text: String(t('picker.modelsNeedServer')) }
          : null;
  const discoveryStatus: SuggestStatus | null = discovery.kind === 'loading'
    ? { text: String(t('picker.serversLoading')) }
    : discovery.kind === 'done'
      ? {
        text: [
          // "No local server answered" is not said next to an address that did answer.
          ...(servers.length > 0
            ? [String(t('picker.serversFound', { count: servers.length }))]
            : discoveryEmptyNoteShown(servers.length, provider === 'local' && modelList.kind === 'ok') ? [String(t('picker.serversNone'))] : []),
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
        options={PROVIDERS.filter((item) => item.value !== 'test' || testProviderOffered()).map((item) => {
          // Your own server is "ready" only with an address, saved for it or typed in this draft.
          const localAddress = prefs.providers.local.baseURL.trim() !== '' || (provider === 'local' && values.baseURL.trim() !== '');
          const state: ProviderKeyState = item.value === 'local' && !localAddress ? 'setup' : providerKeyState(item.value, keySourceOf(keySources, item.value));
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
      {CLOUD_PROVIDERS.has(provider) ? <p className={cx(hintClass, 'provider-sent')}>{t('providers.sentList')}</p> : null}
      {provider === 'compatible' ? (
        <>
          <label className={fieldClass}>
            {t('providers.compatibleAddress')}
            <input
              aria-label={String(t('providers.compatibleAddress'))}
              value={values.baseURL}
              spellCheck={false}
              placeholder="https://"
              onChange={(event) => setRuntime('baseURL', event.target.value)}
              {...fieldError('baseURL')}
            />
          </label>
          <p className={hintClass}>{t('providers.compatibleAddressHint')}</p>
        </>
      ) : null}
      {CLOUD_PROVIDERS.has(provider) ? (
        <KeyPanel
          provider={provider as CloudKeyProvider}
          baseURL={values.baseURL}
          onSession={onSession}
          words={provider === 'compatible' ? {
            name: compatibleHost(values.baseURL) ?? String(t('providers.compatibleName')),
            blocked: compatibleHost(values.baseURL) ? undefined : String(t('providers.compatibleNeedsAddress')),
          } : undefined}
        />
      ) : null}
      {provider === 'openai' || provider === 'anthropic' || provider === 'google' ? <CloudAdvice provider={provider} /> : null}
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
      {provider === 'local' ? (
        <KeyPanel
          provider="local"
          baseURL={values.baseURL}
          onSession={onSession}
          words={{
            name: String(t('settings.providerLocal')),
            label: String(t('providers.localKeyField')),
            hint: String(t('providers.localKeyHint')),
            blocked: values.baseURL.trim() === '' ? String(t('providers.localKeyNeedsAddress')) : undefined,
          }}
        />
      ) : null}
      {/* With no assistant chosen there is no model, address or connection to check */}
      {provider !== '' ? (<>
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
      {provider === 'local' ? <LocalAdvice /> : null}
      {remembered && MODEL_SUGGESTIONS[remembered].length > 0 && !(modelList.kind === 'ok' && models.length > 0) ? (
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
      {provider !== 'local' && provider !== 'compatible' ? (
        <label className={fieldClass}>
          {t('settings.baseUrlOptional')}
          <input
            aria-label={String(t('settings.baseUrl'))}
            value={values.baseURL}
            spellCheck={false}
            onChange={(event) => setRuntime('baseURL', event.target.value)}
            {...fieldError('baseURL')}
          />
        </label>
      ) : null}
      {provider !== 'local' && provider !== 'compatible' ? <p className={hintClass}>{t('settings.cloudBaseUrlHint')}</p> : null}
      {provider === 'openai' ? (
        <>
          <label className={fieldClass}>
            {t('providers.openaiOrganization')}
            <input
              aria-label={String(t('providers.openaiOrganization'))}
              value={prefs.network.openaiOrganization}
              spellCheck={false}
              placeholder="org-…"
              onChange={(event) => patchSection(setPrefs, 'network', { openaiOrganization: event.target.value.trim() })}
            />
          </label>
          <label className={fieldClass}>
            {t('providers.openaiProject')}
            <input
              aria-label={String(t('providers.openaiProject'))}
              value={prefs.network.openaiProject}
              spellCheck={false}
              placeholder="proj_…"
              onChange={(event) => patchSection(setPrefs, 'network', { openaiProject: event.target.value.trim() })}
            />
          </label>
          <p className={hintClass}>{t('providers.openaiAccountHint')}</p>
        </>
      ) : null}
      <div className={cx(rowClass, styles.rowStart)}>
        <Button
          size="sm"
          variant="subtle"
          icon={<PlugZap size={14} aria-hidden="true" />}
          loading={probe.kind === 'running'}
          disabled={pending || probe.kind === 'running'}
          onClick={() => void checkConnection()}
        >
          {probe.kind === 'running' ? t('preferences.checking') : t('preferences.check')}
        </Button>
        <span className={hintClass}>{t(provider === 'local' ? 'preferences.checkHintLocal' : provider === 'test' ? 'preferences.checkHintTest' : 'preferences.checkHint')}</span>
      </div>
      {probeText ? <p className={cx(hintClass, probe.kind === 'ok' ? styles.good : styles.bad)} role="status">{probeText}</p> : null}
      {probe.kind === 'ok' && probe.contextTokens !== null ? (
        // The window the server loaded the model with decides whether the helper's request fits at all.
        <p
          className={cx(hintClass, 'context-window-note', probe.contextTokens < MIN_WORKING_WINDOW ? styles.bad : probe.contextTokens < COMPACT_WINDOW ? styles.warn : styles.good)}
          role="status"
          data-window={probe.contextTokens}
        >
          {t(probe.contextTokens < MIN_WORKING_WINDOW ? 'preferences.windowTooSmall' : probe.contextTokens < COMPACT_WINDOW ? 'preferences.windowSmall' : 'preferences.windowFine', {
            window: probe.contextTokens,
            recommended: RECOMMENDED_WINDOW,
          })}
        </p>
      ) : null}
      {provider === 'local' && ((probe.kind === 'ok' && probe.contextTokens !== null && probe.contextTokens < COMPACT_WINDOW) || variant.note !== '') ? (
        <WindowHelp onVariant={probe.kind === 'ok' ? () => void makeVariant() : null} busy={variant.busy} note={variant.note} />
      ) : null}
      </>) : null}

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
        {provider !== '' ? <NumberField
          label={String(t('preferences.contextTokens'))}
          value={assistant.contextTokens}
          min={CONTEXT_TOKENS.min}
          max={CONTEXT_TOKENS.max}
          step={CONTEXT_TOKENS.step}
          hint={contextHint}
          decreaseLabel={String(t('preferences.decrease', { label: t('preferences.contextTokens') }))}
          increaseLabel={String(t('preferences.increase', { label: t('preferences.contextTokens') }))}
          onChange={(next) => patchSection(setPrefs, 'assistant', { contextTokens: next })}
        /> : null}
        <Switch label={t('preferences.allowWebSearch')} checked={assistant.allowWebSearch} onCheckedChange={(next) => patchSection(setPrefs, 'assistant', { allowWebSearch: next })} />
        <Switch label={t('preferences.allowFetchPage')} checked={assistant.allowFetchPage} onCheckedChange={(next) => patchSection(setPrefs, 'assistant', { allowFetchPage: next })} />
        <p className={hintClass}>{t('preferences.webHint')}</p>
        {provider === 'openai' || provider === 'anthropic' || provider === 'google' ? (
          <p className={cx(hintClass, 'web-search-paid')}>{t('providers.searchPaid', { price: CLOUD_ADVICE[provider].searchPer1000 })}</p>
        ) : null}
        <p className={cx(hintClass, 'web-limits')}>{t('preferences.webLimits', { bytes: formatMegabytes(FETCH_PAGE_BYTE_CAP, isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'), chars: FETCH_PAGE_TEXT_CAP })}</p>
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

      <Group title={String(t('providers.networkTitle'))}>
        <label className={fieldClass}>
          {t('providers.proxyLabel')}
          <input
            aria-label={String(t('providers.proxyLabel'))}
            value={prefs.network.proxy}
            spellCheck={false}
            placeholder="http://proxy.example:8080"
            aria-invalid={proxyAddressValid(prefs.network.proxy) ? undefined : true}
            onChange={(event) => patchSection(setPrefs, 'network', { proxy: event.target.value })}
          />
        </label>
        {proxyAddressValid(prefs.network.proxy) ? null : <p className={styles.errorNote} role="alert">{t('providers.proxyInvalid')}</p>}
        <p className={hintClass}>{t('providers.proxyHint')}</p>
      </Group>
    </>
  );
}
