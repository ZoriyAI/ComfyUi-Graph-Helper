import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, MessageCircleQuestion, Plus, X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Explanation, ExplanationAspect, NodeClassDetail, NodeClassInput, NodeClassSummary, ObjectRef, PackInfo } from '../../../shared/contracts';
import { objectKey } from '../../../shared/contracts';
import { linkTypeNote, packNote } from '../../../shared/knowledge/coreKnowledge';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { ProvenanceBadge } from '../../ui/Badge';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import Skeleton from '../../ui/Skeleton';
import { typeColor } from '../graph/lib/typeColors';
import { useNodeInfoStore } from '../graph/nodeInfo';
import { CARD_WIDTH, useFlyoutBox } from './flyout';
import { plainNumber, safeModelSource } from './libraryModel';
import card from './ModelCard.module.css';
import styles from './NodeCard.module.css';

/** What a node card says of a class, in the order a person asks it: what it is, why, how it is wired, what to watch. */
const ASPECTS: readonly ExplanationAspect[] = ['what', 'why', 'connect', 'risk'];
const NO_EXPLANATIONS: Explanation[] = [];

export interface NodeCardProps {
  node: NodeClassSummary;
  onClose: () => void;
  onAdd: (node: NodeClassSummary) => void;
  /** Sends a question about the class to the Assistant. */
  onAsk: (message: string) => void;
}

/** The newest explanation of each aspect; what the app ships, the helper wrote and the person wrote all count. */
function newestByAspect(list: Explanation[]): Map<ExplanationAspect, Explanation> {
  const found = new Map<ExplanationAspect, Explanation>();
  for (const item of list) {
    if (item.text.trim() === '') continue;
    const held = found.get(item.aspect);
    if (!held || item.createdAt >= held.createdAt) found.set(item.aspect, item);
  }
  return found;
}

function shownValue(value: unknown): string {
  if (typeof value === 'number') return plainNumber(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  return '';
}

/** What a setting takes, in a few words: where it starts, its range, how long its list is. */
function fieldFacts(t: TFunction, input: NodeClassInput): string {
  const spec = input.spec;
  if (!spec) return '';
  const parts: string[] = [];
  if (spec.modelDirectory) parts.push(String(t('library.nodeCard.fieldModel', { folder: spec.modelDirectory })));
  else if (spec.kind === 'combo' && spec.options) parts.push(String(t('library.nodeCard.fieldOptions', { count: spec.options.length })));
  else if (spec.kind === 'string') parts.push(String(t('library.nodeCard.fieldText')));
  if ((spec.kind === 'int' || spec.kind === 'float') && typeof spec.min === 'number' && typeof spec.max === 'number' && Math.abs(spec.max) < 1e9 && Math.abs(spec.min) < 1e9) {
    parts.push(String(t('library.nodeCard.fieldRange', { min: plainNumber(spec.min), max: plainNumber(spec.max) })));
  }
  const start = spec.modelDirectory ? '' : shownValue(spec.default);
  if (start !== '') parts.push(String(t('library.nodeCard.fieldDefault', { value: start })));
  return parts.join(' · ');
}

function TypeMark({ type, language }: { type: string; language: 'en' | 'ru' }) {
  // The built-in note on the data type is the mark's tooltip: what flows through a port of this colour. Read through
  // the knowledge layer, so types a later knowledge set adds (VIDEO, AUDIO, NOISE, GUIDER…) explain themselves too.
  const note = linkTypeNote(type, language)?.what;
  return (
    <span className={styles.type} title={note}>
      <span className={styles.typeDot} style={{ background: typeColor(type) }} aria-hidden="true" />
      {type}
    </span>
  );
}

function PortRow({ input, language }: { input: NodeClassInput; language: 'en' | 'ru' }) {
  const { t } = useTranslation();
  const facts = input.widget ? fieldFacts(t, input) : '';
  const tooltip = (input.tooltip ?? input.spec?.tooltip ?? '').trim();
  return (
    <li className={styles.port}>
      <div className={styles.portHead}>
        <span className={styles.portName}>{input.name}</span>
        <TypeMark type={input.type} language={language} />
        {!input.required ? <span className={styles.optional}>{t('library.nodeCard.optional')}</span> : null}
      </div>
      {facts ? <p className={styles.portFacts}>{facts}</p> : null}
      {tooltip ? <p className={styles.portNote}>{tooltip}</p> : null}
    </li>
  );
}

/** A README opening longer than this, or of more than one paragraph, is folded to a few lines until asked for. */
const PACK_SUMMARY_FOLD_CHARS = 240;

/**
 * What the pack a node comes from says about itself, read from its own files at the last sync: the short
 * description of its pyproject.toml, the opening of its README (folded to a few lines with "More"), and the link
 * to its repository. The link is text to read or copy: the card never opens a page.
 */
function PackAbout({ info }: { info: PackInfo }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const url = safeModelSource(info.repositoryUrl);
  const summary = info.readmeSummary.trim();
  const folds = summary.length > PACK_SUMMARY_FOLD_CHARS || summary.includes('\n\n');
  return (
    <section className={card.section} aria-labelledby="node-card-pack" data-pack-info="">
      <h3 id="node-card-pack" className={card.heading}>{t('library.nodeCard.packAbout')}</h3>
      {info.description ? <p className={card.description}>{info.description}</p> : null}
      {summary ? (
        <p id="node-card-pack-readme" className={`${card.description} ${styles.readme}`} data-open={open || !folds ? 'true' : 'false'}>{summary}</p>
      ) : null}
      {folds ? (
        <button type="button" className={`${card.link} ${styles.more}`} aria-expanded={open} aria-controls="node-card-pack-readme" onClick={() => setOpen((value) => !value)}>
          {open ? t('library.nodeCard.packLess') : t('library.nodeCard.packMore')}
        </button>
      ) : null}
      {url ? (
        <div className={card.source}>
          <span>{t('library.nodeCard.packRepository')}:</span>
          <span className={`${card.url} ${styles.selectable}`} title={url}>{url}</span>
          <IconButton
            size="sm"
            label={String(t('library.nodeCard.packCopyLink'))}
            onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true), () => setCopied(false))}
          >
            <Copy size={13} aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}
      <p className={card.copied} role="status" aria-live="polite">
        {copied ? <><Check size={12} aria-hidden="true" /> {t('library.nodeCard.packLinkCopied')}</> : null}
      </p>
    </section>
  );
}

/**
 * A node class explained before it is put on the canvas: what it is and why it is used, what goes into it, what
 * each of its settings takes, and what comes out. Everything here is read from the catalog and from the knowledge
 * the app holds about the class; nothing is asked of a model.
 */
export default function NodeCard({ node, onClose, onAdd, onAsk }: NodeCardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const box = useFlyoutBox();
  const [detail, setDetail] = useState<NodeClassDetail | null | undefined>(undefined);
  const ref = useMemo<ObjectRef>(() => ({ kind: 'nodeClass', id: node.classType, classType: node.classType }), [node.classType]);
  const explanations = useKnowledgeStore((state) => state.explanations[objectKey(ref)] ?? NO_EXPLANATIONS);

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
    void useNodeInfoStore.getState().request(node.classType).then((found) => {
      if (!cancelled) setDetail(found ?? null);
    });
    void useKnowledgeStore.getState().loadExplanations(ref).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [node.classType, ref]);

  if (!box) return null;
  const name = node.displayName || node.classType;
  const known = newestByAspect(explanations);
  const authorText = (detail?.description ?? '').trim();
  const inputs = detail?.inputs ?? [];
  const sockets = inputs.filter((input) => !input.widget);
  const fields = inputs.filter((input) => input.widget);
  const outputs = detail?.outputs ?? [];
  const read = detail?.detailed === true;
  const pack = node.pack && node.pack !== 'core' ? detail?.packInfo ?? null : null;
  const builtInPack = node.pack && node.pack !== 'core' ? packNote(node.pack, language) : null;

  const body = (
    <section
      className={`node-card ${card.card}`}
      style={{ left: box.left, top: box.top, maxHeight: box.maxHeight, width: CARD_WIDTH }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="node-card-title"
      data-node-class={node.classType}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={card.header}>
        <div className={styles.titles}>
          <h2 id="node-card-title" className={card.title} tabIndex={-1}>{name}</h2>
          {name !== node.classType ? <span className={card.mono}>{node.classType}</span> : null}
        </div>
        <IconButton size="sm" label={String(t('library.card.close'))} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </IconButton>
      </header>

      <div className={card.body}>
        <dl className={card.facts}>
          {node.category ? (
            <>
              <dt>{t('library.nodeCard.category')}</dt>
              <dd>{node.category}</dd>
            </>
          ) : null}
          <dt>{t('library.nodeCard.pack')}</dt>
          <dd>
            {node.pack && node.pack !== 'core' ? node.pack : t('library.nodeCard.core')}
            {/* The built-in word on the pack, when a knowledge set has one: what the pack is for, in one sentence. */}
            {builtInPack ? <span className={styles.packNote} data-pack-note="">{builtInPack.what}</span> : null}
          </dd>
        </dl>
        {pack ? <PackAbout info={pack} /> : null}

        {ASPECTS.map((aspect) => {
          const item = known.get(aspect);
          return item ? (
            <section key={aspect} className={card.section}>
              <div className={styles.aspectHead}>
                <h3 className={card.heading}>{t(aspect === 'why' ? 'knowledge.aspect.whyLibrary' : `knowledge.aspect.${aspect}`)}</h3>
                <ProvenanceBadge provenance={item.provenance} />
              </div>
              <p className={card.description}>{item.text.trim()}</p>
            </section>
          ) : null;
        })}
        {authorText ? (
          <section className={card.section}>
            <h3 className={card.heading}>{t('library.nodeCard.authorDescription')}</h3>
            <p className={card.description}>{authorText}</p>
          </section>
        ) : null}
        {detail !== undefined && known.size === 0 && !authorText ? <p className={card.note}>{t('library.nodeCard.noDescription')}</p> : null}

        {detail === undefined ? <Skeleton height={64} /> : null}
        {detail !== undefined && !read ? <p className={card.note} data-tone="info">{t('library.nodeCard.notRead')}</p> : null}

        {read ? (
          <>
            <section className={card.section} aria-labelledby="node-card-inputs">
              <h3 id="node-card-inputs" className={card.heading}>{t('library.nodeCard.inputs')}</h3>
              {sockets.length > 0
                ? <ul className={styles.ports}>{sockets.map((input) => <PortRow key={input.name} input={input} language={language} />)}</ul>
                : <p className={card.hint}>{t('library.nodeCard.noInputs')}</p>}
            </section>
            {fields.length > 0 ? (
              <section className={card.section} aria-labelledby="node-card-fields">
                <h3 id="node-card-fields" className={card.heading}>{t('library.nodeCard.fields')}</h3>
                <ul className={styles.ports}>{fields.map((input) => <PortRow key={input.name} input={input} language={language} />)}</ul>
              </section>
            ) : null}
            <section className={card.section} aria-labelledby="node-card-outputs">
              <h3 id="node-card-outputs" className={card.heading}>{t('library.nodeCard.outputs')}</h3>
              {outputs.length > 0 ? (
                <ul className={styles.ports}>
                  {outputs.map((output, index) => (
                    <li key={`${output.name}-${index}`} className={styles.port}>
                      <div className={styles.portHead}>
                        {/* An output named after its type (MODEL, LATENT) says it once. */}
                        {output.name !== output.type ? <span className={styles.portName}>{output.name}</span> : null}
                        <TypeMark type={output.type} language={language} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className={card.hint}>{t('library.nodeCard.noOutputs')}</p>}
            </section>
          </>
        ) : null}
      </div>

      <footer className={card.actions}>
        <Button variant="primary" size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onAdd(node)}>
          {t('library.card.add')}
        </Button>
        <Button variant="ghost" size="sm" icon={<MessageCircleQuestion size={14} aria-hidden="true" />} onClick={() => onAsk(String(t('library.nodeCard.askMessage', { name })))}>
          {t('library.card.ask')}
        </Button>
      </footer>
    </section>
  );
  return createPortal(body, document.body);
}
