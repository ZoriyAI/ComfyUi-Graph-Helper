/**
 * The card of a single tool call in a chat message: an explanation the helper saved, a suggestion, a lesson draft,
 * or a tool the chat does not know (with its arguments). Message.tsx renders it for every call that is neither a
 * build step (BuildCard) nor a quiet read (QuietGroup).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Hammer, Lightbulb, Search, Sparkles, Wrench, type LucideIcon } from 'lucide-react';
import type { ExplanationAspect } from '../../../shared/contracts';
import { aspectLabelKey } from '../../../shared/knowledge/labels';
import type { ToolCall, ToolKind } from '../../types/chat';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { asObjectRef, isRecord } from '../../services/llm/chatModel';
import ProvenanceBadge, { isProvenance } from '../explain/ProvenanceBadge';
import { objectLabel } from './objectLabel';
import ProposalCard from './ProposalCard';
// The card of a lesson the assistant drafted (the draftLesson tool).
import ExtensionDraftCard from './ExtensionDraftCard';
import LessonDraftCard from '../lessons/LessonDraftCard';
import Button from '../../ui/Button';
import { compactArgs, toolLabelKey } from './toolPresentation';
import { stepError, type Translate } from './buildSteps';
import styles from './ToolCard.module.css';

/** The head icon of each kind of tool. */
const ICONS: Record<ToolKind, LucideIcon> = {
  read: Search,
  knowledge: Lightbulb,
  proposal: Sparkles,
  build: Hammer,
  other: Wrench,
};

/** The explanation aspects the card can name; any other value in the arguments is not shown. */
const ASPECTS: readonly ExplanationAspect[] = ['what', 'why', 'connect', 'next', 'risk'];

/** The body of an explain call: provenance, aspect, the text, and a button to the object it was saved on. */
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
          <Button variant="subtle" size="sm" icon={<BookOpen size={14} />} onClick={() => setFocus(owner)}>
            {t('chat.showOnCanvas')}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** Arguments behind a disclosure. Rendered only while open, so hidden values never duplicate text on the canvas. */
function ArgumentList({ args }: { args: Array<{ key: string; value: string }> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details className={styles.args} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('chat.toolArguments')}</summary>
      {open ? (
        <dl className={styles.argList}>
          {args.map((item) => (
            <React.Fragment key={item.key}>
              <dt>{item.key}</dt>
              <dd>{item.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </details>
  );
}

/**
 * A tool call that is neither a build step nor a quiet look: an explanation, a suggestion, or a tool the chat does
 * not know. A suggestion carries only its own status (Suggested, Accepted, and so on), never the tool call's; an
 * explanation shows what was saved and where. Graph changes go to BuildCard, reads to QuietGroup.
 */
export default function ToolCard({ call }: { call: ToolCall }) {
  const { t } = useTranslation();
  const translate: Translate = (key, options) => String(options ? t(key, options) : t(key));
  const Icon = ICONS[call.kind];
  const labelKey = toolLabelKey(call.toolName);
  const label = labelKey ? String(t(labelKey)) : String(t('agent.unknownTool', { name: call.toolName }));
  const isExplain = call.toolName === 'explain';
  const isProposal = call.kind === 'proposal' && call.status === 'success' && Boolean(call.proposalId);
  const error = stepError(call, translate);
  // Only a call still running or one that failed says so; a done explanation or suggestion speaks for itself.
  const statusLabel = call.status === 'pending' ? t('chat.toolPending') : call.status === 'error' ? t('chat.toolFailed') : call.kind === 'other' ? t('chat.toolSuccess') : null;
  const args = call.kind === 'other' ? compactArgs(call.args) : [];

  return (
    <div
      className={styles.card}
      data-tool-name={call.toolName}
      data-tool-status={call.status}
      data-tool-kind={call.kind}
    >
      {isProposal && call.proposalId ? (
        <ProposalCard proposalId={call.proposalId} result={call.result} />
      ) : (
        <div className={styles.head}>
          <Icon className={styles.icon} size={14} aria-hidden="true" />
          <span className={`tool-name ${styles.label}`}>{label}</span>
          {statusLabel ? <span className={`tool-status ${styles.status}`} data-state={call.status}>{statusLabel}</span> : null}
        </div>
      )}
      {isExplain ? <ExplainBody call={call} /> : null}
      {call.toolName === 'draftExtension' && call.status === 'success' && isRecord(call.result) && typeof call.result.extensionDraftId === 'string' ? <ExtensionDraftCard draftId={call.result.extensionDraftId} /> : null}
      {call.toolName === 'draftLesson' && call.status === 'success' && isRecord(call.result) && typeof call.result.lessonDraftId === 'string' ? <LessonDraftCard draftId={call.result.lessonDraftId} /> : null}
      {error ? (
        <p className={`tool-diagnostic ${styles.error}`}>
          {error.summary}
          {error.detail ? <span className={styles.detail}> ({error.detail})</span> : null}
        </p>
      ) : null}
      {args.length > 0 ? <ArgumentList args={args} /> : null}
    </div>
  );
}
