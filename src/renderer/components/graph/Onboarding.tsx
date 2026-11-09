import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { FolderInput, Ghost, MessageCircleQuestion, Plug, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button';
import { motionIsFull } from '../../motion/policy';
import { runSyncNow } from '../sync/SyncIndicator';
import { syncView } from '../sync/syncView';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import styles from './Onboarding.module.css';

const STEPS = [
  { icon: <RefreshCw size={18} aria-hidden="true" />, title: 'canvas.onboardSyncTitle', body: 'canvas.onboardSyncBody', tone: 'accent' },
  { icon: <MessageCircleQuestion size={18} aria-hidden="true" />, title: 'canvas.onboardAskTitle', body: 'canvas.onboardAskBody', tone: 'ai' },
  { icon: <Ghost size={18} aria-hidden="true" />, title: 'canvas.onboardBuildTitle', body: 'canvas.onboardBuildBody', tone: 'ghost' },
] as const;

/**
 * The empty canvas: three steps (sync, ask, build with ghosts) and the two ways to begin. Keeps the legacy
 * `.canvas-empty` class and the `graph.empty` sentence. The parent fades it out when the first node lands.
 */
export default function Onboarding({ onImport }: { onImport?: () => void }) {
  const { t } = useTranslation();
  const full = motionIsFull();
  // On a fresh profile there is no MCP address yet: "Sync now" would only fail, so the first step opens Connection.
  const noServer = syncView(useKnowledgeStore((state) => state.sync)).blocked === 'noUrl';
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
        <h2 id="canvas-onboard-title" className={styles.title}>{t('canvas.onboardTitle')}</h2>
        <p className={styles.lead}>{t('graph.empty')}</p>
        <ol className={styles.steps} aria-label={String(t('canvas.onboardSteps'))}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step} data-tone={step.tone}>
              <span className={styles.icon}>{step.icon}</span>
              <span className={styles.number} aria-hidden="true">{index + 1}</span>
              <span className={styles.stepTitle}>{t(step.title)}</span>
              <span className={styles.stepBody}>{t(step.body)}</span>
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          {noServer ? (
            <Button variant="primary" icon={<Plug size={16} />} onClick={() => useUiStore.getState().openSettings('connection')}>
              {t('canvas.onboardConnect')}
            </Button>
          ) : (
            <Button variant="primary" icon={<RefreshCw size={16} />} onClick={() => void runSyncNow().catch(() => undefined)}>
              {t('sync.now')}
            </Button>
          )}
          {onImport ? (
            <Button variant="subtle" icon={<FolderInput size={16} />} onClick={onImport}>
              {t('canvas.onboardImport')}
            </Button>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
