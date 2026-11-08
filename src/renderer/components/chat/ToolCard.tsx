import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Crosshair, Hammer, Lightbulb, Search, Sparkles, Wrench, type LucideIcon } from 'lucide-react';
import type { ExplanationAspect, ObjectRef } from '../../../shared/contracts';
import { aspectLabelKey } from '../../../shared/knowledge/labels';
import type { ToolCall, ToolKind } from '../../types/chat';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { asObjectRef, isRecord } from '../../services/llm/chatModel';
import ProvenanceBadge, { isProvenance } from '../explain/ProvenanceBadge';
import { objectLabel } from './objectLabel';
import ProposalCard from './ProposalCard';
import { buildTargetRef, compactArgs, resultMessage, toolLabelKey } from './toolPresentation';
import styles from './ToolCard.module.css';

const ICONS: Record<ToolKind, LucideIcon> = {
  read: Search,
  knowledge: Lightbulb,
  proposal: Sparkles,
  build: Hammer,
  other: Wrench,
};

const ASPECTS: readonly ExplanationAspect[] = ['what', 'why', 'connect', 'next', 'risk'];

/** Long text fields the card shows on its own rather than in the argument list. */
const OMIT_ARGS: Record<ToolKind, readonly string[]> = {
  read: [],
  knowledge: ['text', 'owner'],
  proposal: ['note'],
  build: ['purpose', 'usage', 'notes', 'annotation'],
  other: [],
};

function ShowButton({ target, label }: { target: ObjectRef; label: string }) {
  const { t } = useTranslation();
  const setFocus = useUiStore((state) => state.setFocus);
  return (
    <button
      type="button"
      className={styles.action}
      aria-label={String(t('chat.toolShowLabel', { object: label }))}
      onClick={() => setFocus(target)}
    >
      <Crosshair size={14} aria-hidden="true" />
      {t('chat.toolShow')}
    </button>
  );
}

function ExplainBody({ call }: { call: ToolCall }) {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const setFocus = useUiStore((state) => state.setFocus);
  const result = isRecord(call.result) ? call.result : {};
  const owner = asObjectRef(result.owner) ?? asObjectRef(call.args.owner);
  // Provenance comes from the saved record; the requested one is shown only while the call is pending.
  const provenance = call.status === 'success' ? result.provenance : call.args.provenance;
  const aspect = ASPECTS.find((item) => item === call.args.aspect);
  const text = typeof call.args.text === 'string' ? call.args.text : '';
  const label = owner ? objectLabel(owner, { nodes, edges }, String(t('explain.processName'))) : '';
  return (
    <>
      <div className={styles.meta}>
        {isProvenance(provenance) ? <ProvenanceBadge provenance={provenance} /> : null}
        {aspect ? <span>{t('chat.explanationAspect', { aspect: t(aspectLabelKey(aspect)) })}</span> : null}
        {owner && call.status === 'success' ? <span>{t('chat.explanationSaved', { object: label })}</span> : null}
      </div>
      {text && call.status !== 'error' ? <p className={styles.explanationText}>{text}</p> : null}
      {owner && call.status === 'success' ? (
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => setFocus(owner)}>
            <BookOpen size={14} aria-hidden="true" />
            {t('chat.showOnCanvas')}
          </button>
        </div>
      ) : null}
    </>
  );
}

function BuildActions({ call }: { call: ToolCall }) {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const target = buildTargetRef(call);
  if (!target) return null;
  return (
    <div className={styles.actions}>
      <ShowButton target={target} label={objectLabel(target, { nodes, edges }, String(t('explain.processName')))} />
    </div>
  );
}

/** One tool call: family icon, label, status, compact arguments, outcome, and the action that fits its family. */
export default function ToolCard({ call }: { call: ToolCall }) {
  const { t } = useTranslation();
  const Icon = ICONS[call.kind];
  const labelKey = toolLabelKey(call.toolName);
  const label = labelKey ? String(t(labelKey)) : String(t('agent.unknownTool', { name: call.toolName }));
  const statusLabel = call.status === 'pending' ? t('chat.toolPending') : call.status === 'success' ? t('chat.toolSuccess') : t('chat.toolFailed');
  const args = compactArgs(call.args, OMIT_ARGS[call.kind]);
  const outcome = resultMessage(call);
  const isExplain = call.toolName === 'explain';

  return (
    <div
      className={styles.card}
      data-tool-name={call.toolName}
      data-tool-status={call.status}
      data-tool-kind={call.kind}
    >
      <div className={styles.head}>
        <Icon className={styles.icon} size={14} aria-label={String(t(`agent.kind.${call.kind}`))} />
        <span className={`tool-name ${styles.label}`}>{label}</span>
        <code className={styles.rawName}>{call.toolName}</code>
        <span className={`tool-status ${styles.status}`} data-state={call.status}>{statusLabel}</span>
      </div>
      {isExplain ? <ExplainBody call={call} /> : null}
      {call.kind === 'proposal' && call.proposalId ? <ProposalCard proposalId={call.proposalId} result={call.result} /> : null}
      {call.status === 'error' && outcome ? (
        <p className={`tool-diagnostic ${styles.error}`}>{outcome}</p>
      ) : null}
      {call.status === 'success' && outcome && !isExplain && call.kind !== 'proposal' ? (
        <p className={styles.summary}>{outcome}</p>
      ) : null}
      {call.kind === 'build' ? <BuildActions call={call} /> : null}
      {args.length > 0 ? (
        <details className={styles.args}>
          <summary>{t('chat.toolArguments')}</summary>
          <dl className={styles.argList}>
            {args.map((item) => (
              <React.Fragment key={item.key}>
                <dt>{item.key}</dt>
                <dd>{item.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
