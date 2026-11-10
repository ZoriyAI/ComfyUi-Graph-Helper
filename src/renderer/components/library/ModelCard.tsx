import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, MessageCircleQuestion, Plus, Replace, Route, X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ExamplePrompt, ModelDetail, ModelNotes, ModelSummary } from '../../../shared/contracts';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { useGraphStore } from '../../state/graphState';
import { usePreferencesStore } from '../../state/preferencesState';
import { FamilyBadge, KindBadge } from '../../ui/Badge';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import Skeleton from '../../ui/Skeleton';
import { loaderForModel } from '../graph/lib/modelLoaders';
import { useMotionLevel } from '../graph/lib/motion';
import { authorTitle, fittingBases, fittingLoras, formatBytes, isBaseModel, modelKey, plainDescription, plainNumber, safeModelSource, sortModels } from './libraryModel';
import { useModelPreview } from './modelPreview';
import { addModelLoader, putModelIntoNode, selectedLoaderFor, type SelectedLoader } from './placeModel';
import styles from './ModelCard.module.css';

/** How many fitting models the card names before "and N more". */
const SHOWN_FITS = 5;
/** How many of the author's example descriptions the card shows. */
const SHOWN_EXAMPLES = 3;
const CARD_WIDTH = 360;

export interface ModelCardProps {
  model: ModelSummary;
  /** Every model file in the catalog: what the card says fits is read from it. */
  all: ModelSummary[];
  onClose: () => void;
  /** Shows the LoRAs that fit a base model in the list. */
  onShowLoras: (base: ModelSummary) => void;
  /** Sends a question about the model to the Assistant. */
  onAsk: (message: string) => void;
}

/**
 * Where the card goes: a flyout just right of the library rail, over the edge of the canvas, so it never covers
 * the row it belongs to. Follows the rail when the window or the rail changes size.
 */
function useFlyoutBox(): { left: number; top: number; maxHeight: number } | null {
  const [box, setBox] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const rail = document.getElementById('library-rail');
    if (!rail) return undefined;
    const measure = () => {
      const rect = rail.getBoundingClientRect();
      const top = rect.top + 8;
      setBox({
        left: Math.min(rect.right + 8, Math.max(8, window.innerWidth - CARD_WIDTH - 8)),
        top,
        maxHeight: Math.max(240, rect.bottom - top - 8),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(rail);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);
  return box;
}

/** The one node selected on the root canvas, or null. */
function useSingleSelectedNode(): string | null {
  return useGraphStore((state) => {
    if (state.activeSubgraphId) return null;
    let found: string | null = null;
    for (const node of state.nodes) {
      if (!node.selected) continue;
      if (found) return null;
      found = node.id;
    }
    return found;
  });
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
function ExamplesSection({ examples, hidden, onReveal, onCopy }: { examples: ExamplePrompt[]; hidden: boolean; onReveal: () => void; onCopy: (text: string) => void }) {
  const { t } = useTranslation();
  if (examples.length === 0) return null;
  const open = examples.filter((item) => !hidden || !item.mature).slice(0, SHOWN_EXAMPLES);
  const closed = hidden ? examples.filter((item) => item.mature).length : 0;
  return (
    <section className={styles.section} aria-labelledby="model-card-examples">
      <h3 id="model-card-examples" className={styles.heading}>{t('library.card.examples')}</h3>
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

/** A model explained and put to work: what it is, what it fits, and the actions that use it. */
export default function ModelCard({ model, all, onClose, onShowLoras, onAsk }: ModelCardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const box = useFlyoutBox();
  const [detail, setDetail] = useState<ModelDetail | null | undefined>(undefined);
  const [copied, copy] = useCopied();
  const [busy, setBusy] = useState(false);
  const selectedId = useSingleSelectedNode();
  const [target, setTarget] = useState<SelectedLoader | null>(null);
  const key = modelKey(model);
  const showMarked = usePreferencesStore((state) => state.preferences.privacy.showMarkedPreviews);
  // "Show for this file" holds for the file it was said about, until the card shows another.
  const [revealed, setRevealed] = useState<string | null>(null);
  // The selected loader already holding this file needs no "put it in" button (right after "Add to canvas").
  const targetValue = useGraphStore((state) => (target ? state.nodes.find((node) => node.id === target.nodeId)?.data.parameters?.[target.field] : undefined));

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
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
  }, [key, selectedId]);

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
        <h2 id="model-card-title" className={styles.title}>{model.name}</h2>
        <IconButton size="sm" label={String(t('library.card.close'))} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </IconButton>
      </header>

      <div className={styles.body}>
        {detail === null ? <p className={styles.note} data-tone="warn">{t('library.card.gone')}</p> : null}

        <PreviewSection model={summary} hidden={hidden} onReveal={() => setRevealed(key)} />

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
        ) : detail && detail.enriched && model.kind === 'lora' ? <p className={styles.note}>{t('library.card.noTriggers')}</p> : null}
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
      </div>

      <footer className={styles.actions}>
        {loader ? (
          <Button variant="primary" size="sm" icon={<Plus size={14} aria-hidden="true" />} disabled={busy} onClick={() => void run(() => addModelLoader(model))}>
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
