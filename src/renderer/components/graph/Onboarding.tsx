import { modelDisplayName } from '../shell/modelDisplayName';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Check, FolderInput, GraduationCap, Languages, MessageCircleQuestion, Plug, RefreshCw, Sparkles } from 'lucide-react';
import Button from '../../ui/Button';
import { motionIsFull } from '../../motion/policy';
import { runSyncNow } from '../sync/SyncIndicator';
import { syncView } from '../sync/syncView';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { keySourceOf, providerKeyState, useProviderStore } from '../../state/providerState';
import { focusChat, openLessons } from '../../commands/actions';
import { runCommand } from '../../commands/registry';
import { LANGUAGE_CHOICES } from '../../commands/appCommands';
import { explainError, type Translator } from '../../../shared/i18n';
import styles from './Onboarding.module.css';

type StepState = 'todo' | 'busy' | 'done' | 'problem';

interface Step {
  key: string;
  icon: React.ReactNode;
  tone: 'accent' | 'ai' | 'ghost';
  title: string;
  text: string;
  state: StepState;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode; primary?: boolean };
}

const PROVIDER_NAMES: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', test: 'TEST' };

/**
 * The empty canvas is the person's first screen, so it leads them through the three things that make the helper
 * useful: connect ComfyUI and read it, choose who answers, ask. Each step shows where it stands right now and the
 * one button that moves it on. Keeps the legacy `.canvas-empty` class and the `graph.empty` sentence; the parent
 * fades it out when the first node lands.
 */
export default function Onboarding({ onImport }: { onImport?: () => void }) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const full = motionIsFull();
  const openSettings = useUiStore((state) => state.openSettings);

  // Step 1: ComfyUI connected and read. The sync status says where that stands.
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const counts = status?.counts;
  const wasRead = status?.state === 'idle' && counts != null && (counts.nodeClasses > 0 || counts.models > 0);
  let connect: Step;
  const connectBase = { key: 'connect', icon: <Plug size={18} aria-hidden="true" />, tone: 'accent' as const, title: translate('canvas.onboardConnectTitle') };
  if (view.blocked === 'noUrl') {
    connect = { ...connectBase, state: 'todo', text: translate('canvas.onboardConnectBody'), action: { label: translate('canvas.onboardConnect'), onClick: () => openSettings('connection'), icon: <Plug size={16} aria-hidden="true" />, primary: true } };
  } else if (status?.state === 'running' || status?.startupPending) {
    connect = { ...connectBase, state: 'busy', text: translate('canvas.onboardReading') };
  } else if (status?.state === 'error') {
    // A busy server is not a wrong address: the way on is to read again, not to change settings.
    const slow = /answered too slowly/.test(status.lastError ?? '');
    connect = {
      ...connectBase,
      state: 'problem',
      text: explainError(translate, status.lastError ?? '').summary,
      action: slow
        ? { label: translate('canvas.onboardReadAgain'), onClick: () => void runSyncNow().catch(() => undefined), icon: <RefreshCw size={16} aria-hidden="true" /> }
        : { label: translate('canvas.onboardOpenConnection'), onClick: () => openSettings('connection') },
    };
  } else if (status?.state === 'idle' && status.lastSyncAt != null && counts && counts.nodeClasses === 0 && counts.models === 0) {
    // The server answered but named no node and no model: say so instead of asking to read again and again.
    connect = { ...connectBase, state: 'problem', text: translate('canvas.onboardReadEmpty'), action: { label: translate('canvas.onboardReadAgain'), onClick: () => void runSyncNow().catch(() => undefined), icon: <RefreshCw size={16} aria-hidden="true" /> } };
  } else if (wasRead && counts) {
    connect = { ...connectBase, state: 'done', text: translate('canvas.onboardReadDone', { nodes: counts.nodeClasses, models: counts.models }) };
  } else {
    connect = { ...connectBase, state: 'todo', text: translate('canvas.onboardReadBody'), action: { label: translate('canvas.onboardRead'), onClick: () => void runSyncNow().catch(() => undefined), icon: <RefreshCw size={16} aria-hidden="true" />, primary: true } };
  }

  // Step 2: someone to answer. A cloud helper without its key cannot answer yet.
  const provider = useProviderStore((state) => state.provider);
  // The chosen provider's own key: a key held for another provider does not make this one ready.
  const keySource = useProviderStore((state) => keySourceOf(state.keySources, state.provider));
  const stored = useProviderStore((state) => state.stored);
  const keyState = providerKeyState(provider, keySource);
  const helperBase = { key: 'helper', icon: <Sparkles size={18} aria-hidden="true" />, tone: 'ai' as const, title: translate('canvas.onboardHelperTitle') };
  let helper: Step;
  if (provider === '') {
    helper = { ...helperBase, state: 'todo', text: translate('canvas.onboardHelperBody'), action: { label: translate('canvas.onboardChooseHelper'), onClick: () => openSettings('assistant'), icon: <Sparkles size={16} aria-hidden="true" />, primary: connect.state === 'done' } };
  } else if (keyState === 'missing') {
    helper = { ...helperBase, state: 'problem', text: translate('canvas.onboardHelperNeedsKey'), action: { label: translate('canvas.onboardAddKey'), onClick: () => openSettings('assistant') } };
  } else {
    // The name a person chose in Settings (provider and model as the list shows it), never an internal id.
    const providerName = provider === 'local' ? translate('provider.localChip') : PROVIDER_NAMES[provider] ?? provider;
    const name = provider === 'test'
      ? translate('provider.testFixture')
      : stored.provider === provider && stored.model ? `${providerName} · ${modelDisplayName(stored.model)}` : provider === 'local' ? translate('canvas.onboardLocalModel') : providerName;
    helper = { ...helperBase, state: 'done', text: translate('canvas.onboardHelperReady', { name }) };
  }

  // Step 3: ask. Always possible; it is the point of the app.
  const ready = connect.state === 'done' && helper.state === 'done';
  const ask: Step = {
    key: 'ask',
    icon: <MessageCircleQuestion size={18} aria-hidden="true" />,
    tone: 'ghost',
    title: translate('canvas.onboardAskTitle'),
    text: translate('canvas.onboardAskBody'),
    state: 'todo',
    action: { label: translate('canvas.onboardAsk'), onClick: focusChat, icon: <MessageCircleQuestion size={16} aria-hidden="true" />, primary: ready },
  };

  const steps = [connect, helper, ask];
  return (
    <motion.section
      className={`canvas-empty ${styles.root}`}
      aria-labelledby="canvas-onboard-title"
      initial={full ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: full ? -6 : 0, transition: { duration: full ? 0.22 : 0 } }}
      transition={{ duration: full ? 0.32 : 0, ease: [0.2, 0, 0, 1] }}
    >
      <div className={styles.card}>
        <LanguageSwitch />
        <h2 id="canvas-onboard-title" className={styles.title}>{t('canvas.onboardTitle')}</h2>
        {/* Once ComfyUI is read and an assistant is chosen, the lead stops promising what is already done. */}
        <p className={styles.lead}>{t('graph.empty')} {t(ready ? 'canvas.onboardLeadReady' : 'canvas.onboardLead')}</p>
        <ol className={styles.steps} data-ready={ready ? 'true' : undefined} aria-label={String(t('canvas.onboardSteps'))}>
          {steps.map((step, index) => (
            <li key={step.key} className={styles.step} data-tone={step.tone} data-state={step.state} data-step={step.key}>
              <span className={styles.icon}>{step.state === 'done' ? <Check size={18} aria-hidden="true" /> : step.icon}</span>
              <span className={styles.number} aria-hidden="true">{index + 1}</span>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepBody} role={step.state === 'busy' || step.state === 'problem' ? 'status' : undefined}>
                {step.state === 'done' ? <span className={styles.srOnly}>{t('canvas.onboardDone')} </span> : null}
                {step.text}
              </span>
              {step.action ? (
                <span className={styles.stepAction}>
                  <Button size="sm" variant={step.action.primary ? 'primary' : 'subtle'} icon={step.action.icon} onClick={step.action.onClick}>
                    {step.action.label}
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          {/* The third way to work with the helper: it leads, the person builds. */}
          <Button variant="subtle" icon={<GraduationCap size={16} aria-hidden="true" />} onClick={openLessons}>
            {t('canvas.onboardLearn')}
          </Button>
          {onImport ? (
            <Button variant="subtle" icon={<FolderInput size={16} aria-hidden="true" />} onClick={onImport}>
              {t('canvas.onboardImport')}
            </Button>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

/**
 * The first thing on the first screen: the other interface language, one click away. The app starts in the
 * system's language; a person who wants the other one should not have to find Settings in a language they do not read.
 */
function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const current = LANGUAGE_CHOICES.find((choice) => choice.value === i18n.resolvedLanguage) ?? LANGUAGE_CHOICES[0];
  const other = LANGUAGE_CHOICES.find((choice) => choice.value !== current.value) ?? current;
  // Each name in its own language, so it reads the same whichever language is on.
  const ownName = (value: string) => String(t(value === 'ru' ? 'settings.languageRussian' : 'settings.languageEnglish'));
  return (
    <span className={styles.language}>
      <Button
        size="sm"
        variant="ghost"
        lang={other.value}
        icon={<Languages size={14} aria-hidden="true" />}
        aria-label={String(t('canvas.onboardLanguage', { current: ownName(current.value), other: ownName(other.value) }))}
        onClick={() => void runCommand(`view.language.${other.value}`)}
      >
        {ownName(other.value)}
      </Button>
    </span>
  );
}
