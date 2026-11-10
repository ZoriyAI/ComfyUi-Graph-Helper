import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, MessageCircleQuestion, Plus, Replace, Route, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModelDetail, ModelSummary } from '../../../shared/contracts';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { useGraphStore } from '../../state/graphState';
import { FamilyBadge, KindBadge } from '../../ui/Badge';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import Skeleton from '../../ui/Skeleton';
import { loaderForModel } from '../graph/lib/modelLoaders';
import { fittingBases, fittingLoras, formatBytes, isBaseModel, modelKey, plainDescription, safeModelSource, sortModels } from './libraryModel';
import { addModelLoader, putModelIntoNode, selectedLoaderFor, type SelectedLoader } from './placeModel';
import styles from './ModelCard.module.css';

/** How many fitting models the card names before "and N more". */
const SHOWN_FITS = 5;
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
        </dl>
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

        <FitsSection model={summary} all={all} onShowLoras={onShowLoras} />

        {description ? (
          <section className={styles.section} aria-labelledby="model-card-description">
            <h3 id="model-card-description" className={styles.heading}>{t('library.card.description')}</h3>
            <p className={styles.description}>{description}</p>
          </section>
        ) : null}
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
