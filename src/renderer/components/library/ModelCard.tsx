import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, EyeOff, Globe, MessageCircleQuestion, Plus, Replace, Route, X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ExamplePrompt, ModelDetail, ModelLookupResult, ModelNotes, ModelSummary, WebError } from '../../../shared/contracts';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { usePreferencesStore } from '../../state/preferencesState';
import { FamilyBadge, KindBadge, ProvenanceBadge } from '../../ui/Badge';
import { hasHiddenCharacters, mixesAlphabets, revealHidden } from '../../../shared/text/reveal';
import { formatCanRunCode } from '../../../shared/security/modelFormat';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import Skeleton from '../../ui/Skeleton';
import { loaderForModel } from '../graph/lib/modelLoaders';
import { useMotionLevel } from '../graph/lib/motion';
import { useGraphStore } from '../../state/graphState';
import { useProjectionStore } from '../../services/commands/projection';
import { useLevelGraph } from '../graph/lib/levelGraph';
import { authorTitle, fittingBases, fittingLoras, formatBytes, isBaseModel, modelKey, plainDescription, plainNumber, safeModelSource, sortModels } from './libraryModel';
import { forgetModelPreview, useModelPreview } from './modelPreview';
import { CARD_WIDTH, useFlyoutBox } from './flyout';
import { addModelLoader, putModelIntoNode, selectedLoaderFor, type SelectedLoader } from './placeModel';
import styles from './ModelCard.module.css';

/** How many fitting models the card names before "and N more". */
const SHOWN_FITS = 5;
/** How many of the author's example descriptions the card shows. */
const SHOWN_EXAMPLES = 3;

export interface ModelCardProps {
  model: ModelSummary;
  /** Every model file in the catalog: what the card says fits is read from it. */
  all: ModelSummary[];
  onClose: () => void;
  /** Shows the LoRAs that fit a base model in the list. */
  onShowLoras: (base: ModelSummary) => void;
  /** Sends a question about the model to the Assistant. */
  onAsk: (message: string) => void;
  /** The file's summary changed (a lookup on the internet gave it a family or a sample). */
  onUpdated?: (summary: ModelSummary) => void;
}

/** The one node selected on the level on screen (the root graph or the open subgraph), or null. */
function useSingleSelectedNode(): string | null {
  const { nodes } = useLevelGraph();
  const selected = nodes.filter((node) => node.selected);
  return selected.length === 1 ? selected[0].id : null;
}

function useCopied(): [string | null, (text: string, label: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => setCopied(label), () => setCopied(null));
  };
  return [copied, copy];
}

function FitList({ models }: { models: ModelSummary[] }) {
  const { t } = useTranslation();
  const shown = models.slice(0, SHOWN_FITS);
  return (
    <ul className={styles.fitList}>
      {shown.map((item) => (
        <li key={modelKey(item)} className={styles.fitItem}>
          <span className={styles.fitName} title={`${item.directory}/${item.name}`}>{item.name}</span>
          <FamilyBadge family={item.baseModel} />
        </li>
      ))}
      {models.length > shown.length ? <li className={styles.fitMore}>{t('library.card.more', { count: models.length - shown.length })}</li> : null}
    </ul>
  );
}

/** What fits this model: base models for a LoRA, LoRAs for a base model. Other kinds have no such list. */
function FitsSection({ model, all, onShowLoras }: { model: ModelSummary; all: ModelSummary[]; onShowLoras: (base: ModelSummary) => void }) {
  const { t } = useTranslation();
  const family = String(t(familyLabelKey(model.baseModel)));
  const bases = useMemo(() => (model.kind === 'lora' ? sortModels(fittingBases(model, all), 'name') : []), [model, all]);
  const loras = useMemo(() => (isBaseModel(model) ? fittingLoras(model, all) : []), [model, all]);
  if (model.kind !== 'lora' && !isBaseModel(model)) return null;
  let body: React.ReactNode;
  if (model.baseModel === 'unknown') {
    body = <p className={styles.note}>{t(model.kind === 'lora' ? 'library.card.fitsUnknown' : 'library.card.baseUnknown')}</p>;
  } else if (model.kind === 'lora') {
    body = bases.length > 0
      ? (
        <>
          <p className={styles.lead}>{t('library.card.fitsBases')}</p>
          <FitList models={bases} />
        </>
      )
      : <p className={styles.note} data-tone="warn">{t('library.card.noBases', { family })}</p>;
  } else {
    body = loras.length > 0
      ? (
        <p className={styles.lead}>
          {t('library.card.lorasFit', { count: loras.length })}
          {' · '}
          <button type="button" className={styles.link} onClick={() => onShowLoras(model)}>{t('library.card.showLoras')}</button>
        </p>
      )
      : <p className={styles.note}>{t('library.card.noLoras', { family })}</p>;
  }
  return (
    <section className={styles.section} aria-labelledby="model-card-fits">
      <h3 id="model-card-fits" className={styles.heading}>{t('library.card.fits')}</h3>
      {body}
    </section>
  );
}

/**
 * The picture or the clip a model manager keeps next to the file. One its author marked as adult content is not
 * asked for until the person says so, for this file or in Settings ▸ Privacy.
 */
function PreviewSection({ model, hidden, onReveal }: { model: ModelSummary; hidden: boolean; onReveal: () => void }) {
  const { t } = useTranslation();
  const motion = useMotionLevel();
  const preview = useModelPreview(hidden ? null : model);
  if (!model.preview) return null;
  let body: React.ReactNode;
  if (hidden) {
    body = (
      <div className={styles.previewHidden}>
        <p className={styles.previewNote}>{t('library.card.marked')}</p>
        <Button variant="subtle" size="sm" onClick={onReveal}>{t('library.card.markedShow')}</Button>
        <p className={styles.hint}>{t('library.card.markedAlways')}</p>
      </div>
    );
  } else if (preview.state === 'ready' && preview.kind === 'video') {
    // A clip plays by itself only where motion is welcome; it never has sound, and it can always be paused.
    body = <video className={styles.previewMedia} src={preview.url} muted loop playsInline controls autoPlay={motion === 'full'} aria-label={String(t('library.card.previewAlt', { name: model.name }))} />;
  } else if (preview.state === 'ready') {
    body = <img className={styles.previewMedia} src={preview.url} alt={String(t('library.card.previewAlt', { name: model.name }))} draggable={false} />;
  } else if (preview.state === 'failed') {
    body = <p className={styles.note}>{t('library.card.previewFailed')}</p>;
  } else {
    body = <div className={styles.previewWait} role="status" aria-label={String(t('library.card.previewLoading'))}><Skeleton height={150} /></div>;
  }
  return (
    <section className={styles.preview} aria-label={String(t('library.card.preview'))} data-preview={hidden ? 'hidden' : preview.state}>
      {body}
    </section>
  );
}

/** How the author says to use the file: the strength to start from, the range it works in. */
function usageLines(t: TFunction, usage: ModelNotes['usage']): string[] {
  const lines: string[] = [];
  if (usage.strength !== null) lines.push(String(t('library.card.usageStrength', { value: plainNumber(usage.strength) })));
  if (usage.strengthMin !== null && usage.strengthMax !== null) lines.push(String(t('library.card.usageRange', { min: plainNumber(usage.strengthMin), max: plainNumber(usage.strengthMax) })));
  else if (usage.strengthMin !== null) lines.push(String(t('library.card.usageMin', { min: plainNumber(usage.strengthMin) })));
  else if (usage.strengthMax !== null) lines.push(String(t('library.card.usageMax', { max: plainNumber(usage.strengthMax) })));
  if (usage.clipSkip !== null) lines.push(String(t('library.card.usageClipSkip', { value: plainNumber(usage.clipSkip) })));
  return lines;
}

function exampleSettings(t: TFunction, example: ExamplePrompt): string {
  const parts: string[] = [];
  if (example.steps !== null) parts.push(String(t('library.card.exampleSteps', { value: plainNumber(example.steps) })));
  if (example.cfg !== null) parts.push(String(t('library.card.exampleCfg', { value: plainNumber(example.cfg) })));
  if (example.sampler) parts.push(example.sampler);
  return parts.join(' · ');
}

/**
 * The descriptions the author used for the sample pictures: how this file is asked for, in its author's words.
 * Those that belong to a sample marked as adult content stay closed until the person opens them.
 */
function ExamplesSection({ examples, hidden, onReveal, onCopy, id = 'model-card-examples', heading = 'library.card.examples' }: {
  examples: ExamplePrompt[];
  hidden: boolean;
  onReveal: () => void;
  onCopy: (text: string) => void;
  id?: string;
  heading?: 'library.card.examples' | 'library.card.web.examples';
}) {
  const { t } = useTranslation();
  if (examples.length === 0) return null;
  const open = examples.filter((item) => !hidden || !item.mature).slice(0, SHOWN_EXAMPLES);
  const closed = hidden ? examples.filter((item) => item.mature).length : 0;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h3 id={id} className={styles.heading}>{t(heading)}</h3>
      {open.length > 0 ? <p className={styles.hint}>{t('library.card.examplesHint')}</p> : null}
      <ul className={styles.examples}>
        {open.map((example) => {
          const settings = exampleSettings(t, example);
          return (
            <li key={example.prompt} className={styles.example}>
              <p className={styles.examplePrompt}>{example.prompt}</p>
              {example.negative ? <p className={styles.exampleNegative}><span>{t('library.card.exampleNegative')}</span> {example.negative}</p> : null}
              <div className={styles.exampleFoot}>
                <span className={styles.exampleSettings}>{settings}</span>
                <button type="button" className={styles.link} onClick={() => onCopy(example.prompt)}>{t('library.card.exampleCopy')}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {closed > 0 ? (
        <p className={styles.note}>
          {t('library.card.hiddenExamples', { count: closed })}
          {' '}
          <button type="button" className={styles.link} onClick={onReveal}>{t('library.card.markedShow')}</button>
        </p>
      ) : null}
    </section>
  );
}

/** Each reason a lookup fails, as the sentence that says it. */
const WEB_ERROR_KEYS: Record<WebError, string> = {
  unreachable: 'library.card.web.errors.unreachable',
  timeout: 'library.card.web.errors.timeout',
  'rate-limited': 'library.card.web.errors.rateLimited',
  server: 'library.card.web.errors.server',
  'bad-answer': 'library.card.web.errors.badAnswer',
  'no-hash': 'library.card.web.errors.noHash',
  'no-server': 'library.card.web.errors.noServer',
};

/** Where "Find on the internet" is: not started, making the fingerprint on the server, asking the sites. */
type LookupStep = 'idle' | 'hashing' | 'looking';

/**
 * "From the internet": what Civitai (by the file's fingerprint) or Hugging Face (by its name, a guess) said about a
 * file nothing from Civitai describes, or the button that asks. It is always clear where it came from and how sure
 * it is. Example prompts the site marks as adult stay closed like the ones next to a file.
 */
function WebSection({ detail, step, error, hidden, onFind, onReveal, onCopy }: {
  detail: ModelDetail;
  step: LookupStep;
  error: WebError | null;
  hidden: boolean;
  onFind: () => void;
  onReveal: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const { t } = useTranslation();
  if (detail.civitaiKnown) return null;
  const { web } = detail;
  const found = web.found;
  const failure = error ?? (web.status === 'error' ? web.error : null);
  const link = found ? safeModelSource(found.url) : null;
  let body: React.ReactNode;
  if (step !== 'idle') {
    body = (
      <div className={styles.webBusy} role="status" aria-live="polite">
        <p className={styles.lead}>{t(step === 'hashing' ? 'library.card.web.hashing' : 'library.card.web.looking')}</p>
        {step === 'hashing' ? <p className={styles.hint}>{t('library.card.web.hashingHint')}</p> : null}
      </div>
    );
  } else if (found) {
    body = (
      <>
        <p className={styles.webSource}>
          <ProvenanceBadge provenance="web" />
          <span className={styles.webSite}>{t(found.source === 'civitai' ? 'library.card.web.civitai' : 'library.card.web.huggingface')}</span>
        </p>
        <p className={styles.note} data-tone={found.byName ? 'warn' : 'info'}>{t(found.byName ? 'library.card.web.byName' : 'library.card.web.exact')}</p>
        <dl className={styles.facts}>
          {found.notes.title ? (
            <>
              <dt>{t('library.card.web.title')}</dt>
              <dd className={styles.wrap}>{found.notes.title}</dd>
            </>
          ) : null}
          {found.notes.versionName ? (
            <>
              <dt>{t('library.card.version')}</dt>
              <dd className={styles.wrap}>{found.notes.versionName}</dd>
            </>
          ) : null}
          {found.notes.creator ? (
            <>
              <dt>{t('library.card.creator')}</dt>
              <dd className={styles.wrap}>{found.notes.creator}</dd>
            </>
          ) : null}
          {found.notes.baseModelLabel ? (
            <>
              <dt>{t('library.card.authorBase')}</dt>
              <dd className={styles.wrap}>{found.notes.baseModelLabel}</dd>
            </>
          ) : null}
        </dl>
        {found.notes.mature ? <p className={styles.hint}>{t('library.card.web.marked')}</p> : null}
        {found.notes.tags.length > 0 ? (
          <ul className={styles.tags} aria-label={String(t('library.card.tags'))}>
            {found.notes.tags.map((tag) => <li key={tag} className={styles.tag}>{tag}</li>)}
          </ul>
        ) : null}
        {found.triggerWords.length > 0 ? (
          <div className={styles.section}>
            <h4 className={styles.heading}>{t('library.card.triggers')}</h4>
            <ul className={styles.chips}>
              {found.triggerWords.map((word) => (
                <li key={word}>
                  <button type="button" className={styles.chip} title={String(t('library.card.copied', { word }))} onClick={() => onCopy(word, String(t('library.card.copied', { word })))}>
                    <Copy size={11} aria-hidden="true" />
                    {word}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {found.summary ? (
          <div className={styles.section}>
            <h4 className={styles.heading}>{t('library.card.web.summary')}</h4>
            <p className={styles.description}>{found.summary}</p>
          </div>
        ) : null}
        <ExamplesSection
          id="model-card-web-examples"
          heading="library.card.web.examples"
          examples={found.notes.examples}
          hidden={hidden}
          onReveal={onReveal}
          onCopy={(text) => onCopy(text, String(t('library.card.exampleCopied')))}
        />
        {link ? (
          <div className={styles.source}>
            <span>{t('library.card.web.link')}:</span>
            <span className={styles.url} title={link}>{link}</span>
            <IconButton size="sm" label={String(t('library.card.copyLink'))} onClick={() => onCopy(link, String(t('library.card.copyLink')))}>
              <Copy size={13} aria-hidden="true" />
            </IconButton>
          </div>
        ) : null}
        {found.byName ? (
          // A guess by the name may be refreshed: the repository may have changed, or a sample may be there now.
          <div className={styles.webAgain}>
            {error ? <p className={styles.note} data-tone="warn">{t('library.card.web.failed', { reason: String(t(WEB_ERROR_KEYS[error])) })}</p> : null}
            <p className={styles.hint}>{t('library.card.web.findHint')}</p>
            <div>
              <Button variant="subtle" size="sm" icon={<Globe size={14} aria-hidden="true" />} onClick={onFind}>{t('library.card.web.again')}</Button>
            </div>
          </div>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        {web.status === 'not-found' && !error ? <p className={styles.note}>{t('library.card.web.notFound')}</p> : null}
        {failure ? <p className={styles.note} data-tone="warn">{t('library.card.web.failed', { reason: String(t(WEB_ERROR_KEYS[failure])) })}</p> : null}
        <p className={styles.hint}>{t('library.card.web.findHint')}</p>
        <div>
          <Button variant="subtle" size="sm" icon={<Globe size={14} aria-hidden="true" />} onClick={onFind}>
            {t(web.status === null && !failure ? 'library.card.web.find' : 'library.card.web.again')}
          </Button>
        </div>
      </>
    );
  }
  return (
    <section className={styles.section} aria-labelledby="model-card-web" data-web={step !== 'idle' ? step : found ? 'found' : failure ? 'error' : web.status ?? 'idle'}>
      <h3 id="model-card-web" className={styles.heading}>{t('library.card.web.heading')}</h3>
      {body}
    </section>
  );
}

/** A model explained and put to work: what it is, what it fits, and the actions that use it. */
/** The summary part of a card's detail, as a list row holds it. */
function summaryOf(detail: ModelDetail): ModelSummary {
  const { directory, name, kind, baseModel, sizeBytes, enriched, title, preview, mature } = detail;
  return { directory, name, kind, baseModel, sizeBytes, enriched, title, preview, mature };
}

export default function ModelCard({ model, all, onClose, onShowLoras, onAsk, onUpdated }: ModelCardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const box = useFlyoutBox();
  const [detail, setDetail] = useState<ModelDetail | null | undefined>(undefined);
  const [copied, copy] = useCopied();
  const [busy, setBusy] = useState(false);
  const selectedId = useSingleSelectedNode();
  const [target, setTarget] = useState<SelectedLoader | null>(null);
  const key = modelKey(model);
  const currentKey = useRef(key);
  currentKey.current = key;
  const showMarked = usePreferencesStore((state) => state.preferences.privacy.showMarkedPreviews);
  // "Show for this file" holds for the file it was said about, until the card shows another.
  const [revealed, setRevealed] = useState<string | null>(null);
  // "Find on the internet": the step it is at, and the reason of a failure it just had.
  const [step, setStep] = useState<LookupStep>('idle');
  const [lookupError, setLookupError] = useState<WebError | null>(null);
  // The selected loader already holding this file needs no "put it in" button (right after "Add to canvas").
  const levelGraph = useLevelGraph();
  const definitionId = useGraphStore((state) => state.activeSubgraphId);
  const graphIdentity = useProjectionStore((state) => `${state.projectId}:${state.graphKey}`);
  const targetValue = target ? levelGraph.nodes.find((node) => node.id === target.nodeId)?.data.parameters?.[target.field] : undefined;

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
    setStep('idle');
    setLookupError(null);
    window.electronAPI.modelDetail(model.directory, model.name)
      .then((found) => {
        if (!cancelled) setDetail(found);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
    // The key names the file; a new summary object for the same file is not a new card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    setTarget(null);
    if (!selectedId) return undefined;
    void selectedLoaderFor(model, selectedId).then((found) => {
      if (!cancelled) setTarget(found);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selectedId, definitionId, graphIdentity]);

  if (!box) return null;
  const summary = detail ?? model;
  const loader = loaderForModel(model.directory, model.name);
  const notes = detail?.notes ?? null;
  const title = authorTitle(summary);
  const hidden = summary.mature && !showMarked && revealed !== key;
  const usage = notes ? usageLines(t, notes.usage) : [];
  const triggers = detail?.triggerWords ?? [];
  const description = detail?.description ? plainDescription(detail.description) : '';
  const source = safeModelSource(detail?.sourceUrl);
  const evidence = detail ? detail.baseModelEvidence : (summary.baseModel === 'unknown' ? 'none' : 'filename');

  // Two steps, each said on screen: the fingerprint on the server when it is not known (long for a large file),
  // then the lookup. A card switched to another file meanwhile drops the answer; main keeps it for the next opening.
  const find = async () => {
    const asked = key;
    const still = () => currentKey.current === asked;
    const settle = (result: ModelLookupResult): boolean => {
      if (!still()) return false;
      forgetModelPreview(asked);
      setDetail(result.detail);
      if (result.detail) onUpdated?.(summaryOf(result.detail));
      if (!result.ok) {
        setLookupError(result.error);
        return false;
      }
      return true;
    };
    setLookupError(null);
    try {
      if (!detail?.sha256) {
        setStep('hashing');
        if (!settle(await window.electronAPI.modelHash(model.directory, model.name))) return;
      }
      if (!still()) return;
      setStep('looking');
      settle(await window.electronAPI.modelLookup(model.directory, model.name));
    } catch {
      if (still()) setLookupError('unreachable');
    } finally {
      if (still()) setStep('idle');
    }
  };

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <section
      className={`model-card ${styles.card}`}
      style={{ left: box.left, top: box.top, maxHeight: box.maxHeight, width: CARD_WIDTH }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="model-card-title"
      data-model={key}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={styles.header}>
        <h2 id="model-card-title" className={styles.title} tabIndex={-1}>{revealHidden(model.name)}</h2>
        <IconButton size="sm" label={String(t('library.card.close'))} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </IconButton>
      </header>

      <div className={styles.body}>
        {detail === null ? <p className={styles.note} data-tone="warn">{t('library.card.gone')}</p> : null}
        {/* What the name or the format of the file itself says about it (shared/text/reveal.ts, shared/security). */}
        {hasHiddenCharacters(model.name) ? <p className={styles.note} data-tone="warn" data-testid="model-name-hidden">{t('library.card.nameHidden')}</p> : null}
        {mixesAlphabets(model.name) ? <p className={styles.note} data-tone="warn" data-testid="model-name-mixed">{t('library.card.nameMixed')}</p> : null}
        {formatCanRunCode(model.name) ? <p className={styles.note} data-tone="warn" data-testid="model-format-code">{t('library.card.formatCode')}</p> : null}

        <PreviewSection model={summary} hidden={hidden} onReveal={() => setRevealed(key)} />
        {/* Shown for this file on request: the same place closes it again. */}
        {summary.mature && !showMarked && revealed === key ? (
          <div className={styles.askRow}>
            <Button variant="ghost" size="sm" icon={<EyeOff size={14} aria-hidden="true" />} onClick={() => setRevealed(null)}>{t('library.card.markedHide')}</Button>
          </div>
        ) : null}

        {title ? (
          <div className={styles.author}>
            <span className={styles.heading}>{t('library.card.authorName')}</span>
            <span className={styles.authorName}>{title}</span>
          </div>
        ) : null}

        <dl className={styles.facts}>
          <dt>{t('library.card.family')}</dt>
          <dd className={styles.familyLine}>
            {summary.baseModel === 'unknown'
              ? <span className={styles.unknown}>{t('library.card.evidence.none')}</span>
              : <FamilyBadge family={summary.baseModel} />}
            {summary.baseModel !== 'unknown'
              ? <span className={styles.evidence}>{t(`library.card.evidence.${evidence}`)}</span>
              : null}
          </dd>
          <dt>{t('library.card.kind')}</dt>
          <dd><KindBadge kind={summary.kind} /></dd>
          <dt>{t('library.card.size')}</dt>
          <dd>{formatBytes(summary.sizeBytes, language)}</dd>
          <dt>{t('library.card.folder')}</dt>
          <dd className={styles.mono}>{model.directory}</dd>
          {notes?.baseModelLabel ? (
            <>
              <dt>{t('library.card.authorBase')}</dt>
              <dd>{notes.baseModelLabel}</dd>
            </>
          ) : null}
          {notes?.versionName ? (
            <>
              <dt>{t('library.card.version')}</dt>
              <dd>{notes.versionName}</dd>
            </>
          ) : null}
          {notes?.creator ? (
            <>
              <dt>{t('library.card.creator')}</dt>
              <dd>{notes.creator}</dd>
            </>
          ) : null}
        </dl>
        {notes && notes.tags.length > 0 ? (
          <ul className={styles.tags} aria-label={String(t('library.card.tags'))}>
            {notes.tags.map((tag) => <li key={tag} className={styles.tag}>{tag}</li>)}
          </ul>
        ) : null}
        {summary.baseModel === 'unknown' && detail?.enriched ? <p className={styles.note}>{t('library.card.familyUnknown')}</p> : null}
        {!summary.enriched ? <p className={styles.note} data-tone="info">{t('library.card.notRead')}</p> : null}

        {detail === undefined ? <Skeleton height={48} /> : null}

        {triggers.length > 0 ? (
          <section className={styles.section} aria-labelledby="model-card-triggers">
            <div className={styles.sectionHead}>
              <h3 id="model-card-triggers" className={styles.heading}>{t('library.card.triggers')}</h3>
              <button
                type="button"
                className={styles.link}
                onClick={() => copy(triggers.join(', '), String(t('library.card.copiedAll')))}
              >
                {t('library.card.copyAll')}
              </button>
            </div>
            <p className={styles.hint}>{t('library.card.triggersHint')}</p>
            <ul className={styles.chips}>
              {triggers.map((word) => (
                <li key={word}>
                  <button
                    type="button"
                    className={styles.chip}
                    title={String(t('library.card.copied', { word }))}
                    onClick={() => copy(word, String(t('library.card.copied', { word })))}
                  >
                    <Copy size={11} aria-hidden="true" />
                    {word}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : detail && detail.enriched && model.kind === 'lora' && !detail.web.found?.triggerWords.length ? <p className={styles.note}>{t('library.card.noTriggers')}</p> : null}
        <p className={styles.copied} role="status" aria-live="polite">
          {copied ? <><Check size={12} aria-hidden="true" /> {copied}</> : null}
        </p>

        {usage.length > 0 ? (
          <section className={styles.section} aria-labelledby="model-card-usage">
            <h3 id="model-card-usage" className={styles.heading}>{t('library.card.usage')}</h3>
            <ul className={styles.usage}>
              {usage.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
        ) : null}
        {notes?.notes ? (
          <section className={styles.section} aria-labelledby="model-card-notes">
            <h3 id="model-card-notes" className={styles.heading}>{t('library.card.notes')}</h3>
            <p className={styles.description}>{notes.notes}</p>
          </section>
        ) : null}

        <FitsSection model={summary} all={all} onShowLoras={onShowLoras} />

        {description ? (
          <section className={styles.section} aria-labelledby="model-card-description">
            <h3 id="model-card-description" className={styles.heading}>{t('library.card.description')}</h3>
            <p className={styles.description}>{description}</p>
          </section>
        ) : null}
        {notes ? <ExamplesSection examples={notes.examples} hidden={hidden} onReveal={() => setRevealed(key)} onCopy={(text) => copy(text, String(t('library.card.exampleCopied')))} /> : null}
        {source ? (
          <div className={styles.source}>
            <span>{t('library.card.source')}:</span>
            <span className={styles.url} title={source}>{source}</span>
            <IconButton size="sm" label={String(t('library.card.copyLink'))} onClick={() => copy(source, String(t('library.card.copyLink')))}>
              <Copy size={13} aria-hidden="true" />
            </IconButton>
          </div>
        ) : null}
        {detail ? (
          <WebSection
            detail={detail}
            step={step}
            error={lookupError}
            hidden={!showMarked && revealed !== key}
            onFind={() => void find()}
            onReveal={() => setRevealed(key)}
            onCopy={copy}
          />
        ) : null}
      </div>

      <footer className={styles.actions}>
        {loader ? (
          <Button variant="primary" size="sm" icon={<Plus size={14} aria-hidden="true" />} disabled={busy} onClick={() => void run(async () => {
            await addModelLoader(model);
            // The node is on the canvas and a toast says so; the card steps aside so it is not hidden.
            onClose();
          })}>
            {t('library.card.add')}
          </Button>
        ) : <p className={styles.note}>{t('library.card.noLoader', { folder: model.directory })}</p>}
        {target && targetValue !== model.name ? (
          <Button
            variant="subtle"
            size="sm"
            icon={<Replace size={14} aria-hidden="true" />}
            disabled={busy}
            title={String(t('library.card.replaceHint', { node: target.title }))}
            onClick={() => void run(() => putModelIntoNode(model, target))}
          >
            {t('library.card.replace')}
          </Button>
        ) : null}
        <div className={styles.askRow}>
          <Button variant="ghost" size="sm" icon={<MessageCircleQuestion size={14} aria-hidden="true" />} onClick={() => onAsk(String(t('library.askModelMessage', { name: model.name })))}>
            {t('library.card.ask')}
          </Button>
          <Button variant="ghost" size="sm" icon={<Route size={14} aria-hidden="true" />} onClick={() => onAsk(String(t('library.card.howConnectMessage', { name: model.name })))}>
            {t('library.card.howConnect')}
          </Button>
        </div>
      </footer>
    </section>
  );
  return createPortal(card, document.body);
}
