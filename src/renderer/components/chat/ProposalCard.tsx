import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, X } from 'lucide-react';
import { PROPOSAL_KINDS, type ProposalKind, type ProposalStatus } from '../../../shared/contracts';
import { redactDiagnostic } from '../../../shared/i18n';
import { useProposalsStore } from '../../state/proposalsState';
import { isRecord } from '../../services/llm/chatModel';
import styles from './ToolCard.module.css';

function kindOf(value: unknown): ProposalKind | null {
  return typeof value === 'string' && (PROPOSAL_KINDS as readonly string[]).includes(value) ? value as ProposalKind : null;
}

/**
 * A ghost the assistant suggested, with the suggestion's own status only (Suggested, Accepted, Rejected, Out of
 * date): the tool call that made it is not a second status. Accept and Reject go only through
 * useProposalsStore().resolve; the chat never writes the graph itself.
 */
export default function ProposalCard({ proposalId, result }: { proposalId: string; result: unknown }) {
  const { t } = useTranslation();
  const proposal = useProposalsStore((state) => state.proposals.find((item) => item.id === proposalId));
  const resolving = useProposalsStore((state) => state.resolving.includes(proposalId));
  const resolve = useProposalsStore((state) => state.resolve);
  const [error, setError] = useState<string | null>(null);

  const kind = proposal?.kind ?? kindOf(isRecord(result) ? result.kind : undefined);
  const note = proposal?.note ?? (isRecord(result) && typeof result.note === 'string' ? result.note : '');
  const status: ProposalStatus = proposal?.status ?? 'proposed';
  const kindLabel = kind ? String(t(`proposals.kind.${kind}`)) : String(t('agent.kind.proposal'));

  const decide = async (decision: 'accept' | 'reject') => {
    setError(null);
    try {
      await resolve(proposalId, decision);
    } catch (reason) {
      setError(redactDiagnostic(reason instanceof Error ? reason.message : String(reason)));
    }
  };

  return (
    <div className={`proposal-card ${styles.proposal}`} data-proposal-id={proposalId} data-proposal-status={status}>
      <div className={styles.proposalHead}>
        <Sparkles className={styles.proposalIcon} size={14} aria-hidden="true" />
        <span className={styles.kind}>{kindLabel}</span>
        <span className={styles.chip} data-status={status}>{t(`proposals.status.${status}`)}</span>
      </div>
      {note ? (
        <p className={styles.note}>
          <span className={styles.noteLabel}>{t('proposals.noteLabel')}:</span>
          {note}
        </p>
      ) : null}
      {status === 'superseded' ? <p className={styles.hint}>{t('proposals.supersededHint')}</p> : null}
      {status === 'proposed' ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.action} ${styles.primary}`}
            disabled={resolving}
            aria-label={String(t('proposals.acceptLabel', { kind: kindLabel }))}
            onClick={() => void decide('accept')}
          >
            <Check size={14} aria-hidden="true" />
            {resolving ? t('proposals.resolving') : t('proposals.accept')}
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={resolving}
            aria-label={String(t('proposals.rejectLabel', { kind: kindLabel }))}
            onClick={() => void decide('reject')}
          >
            <X size={14} aria-hidden="true" />
            {t('proposals.reject')}
          </button>
        </div>
      ) : null}
      {error ? <p className={styles.error} role="status">{error}</p> : null}
    </div>
  );
}
