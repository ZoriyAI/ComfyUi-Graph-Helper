import React from 'react';
import { AlertTriangle, ClipboardCopy, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import { redactSecrets } from '../shared/config/draft';
import { copyDiagnostics, reportRendererError } from './services/diagnostics/diagnostics';
import styles from './ErrorBoundary.module.css';

/** The card shown instead of the app after a render error: what happened, collapsed details, Reload and Copy. */
export function ErrorFallback({ error, onReload, onCopy }: { error: Error; onReload: () => void; onCopy: () => void }) {
  const { t } = useTranslation();
  const details = redactSecrets(`${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`).slice(0, 4000);
  return (
    <div className={styles.screen}>
      <section className={`${styles.card} app-error-fallback`} role="alert" aria-labelledby="app-error-title">
        <AlertTriangle size={24} aria-hidden="true" />
        <h1 id="app-error-title" className={styles.title}>{t('diagnostics.boundaryTitle')}</h1>
        <p className={styles.body}>{t('diagnostics.boundaryBody')}</p>
        <details className={styles.details}>
          <summary>{t('diagnostics.boundaryDetails')}</summary>
          <pre>{details}</pre>
        </details>
        <div className={styles.actions}>
          <Button variant="ghost" icon={<ClipboardCopy size={16} aria-hidden="true" />} onClick={onCopy}>{t('diagnostics.copy')}</Button>
          <Button variant="primary" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={onReload}>{t('diagnostics.reload')}</Button>
        </div>
      </section>
    </div>
  );
}

interface State { error: Error | null }

/** Catches render errors of the app, reports them to the main log, and shows ErrorFallback. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportRendererError({
      kind: 'boundary',
      message: `${error.name}: ${error.message}`,
      stack: `${error.stack ?? ''}${info.componentStack ? `\nComponent stack:${info.componentStack}` : ''}`,
    });
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback error={this.state.error} onReload={() => window.location.reload()} onCopy={() => void copyDiagnostics()} />;
  }
}
