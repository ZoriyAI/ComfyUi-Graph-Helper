import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import '@fontsource/geist/400.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/cyrillic-400.css';
import '@fontsource/geist/cyrillic-600.css';
// Global tokens and base rules first, so component CSS Modules (imported below through App) come later
// in the cascade and win at equal specificity.
import './theme/tokens.css';
import './theme.css';
import App from './App';
import { i18n, startI18n } from './i18n';
import MotionRoot from './motion/MotionRoot';
import { HintProvider } from './ui/Hint';
import { ToastProvider } from './ui/Toast';
import { languageOf, type AppLanguage } from '../shared/i18n';
import { isForeignDrag } from './dropGuard';
import ErrorBoundary from './ErrorBoundary';
import { installRendererErrorReporting } from './services/diagnostics/diagnostics';

// Uncaught errors and unhandled rejections are written to the main log (redacted, rate-limited).
installRendererErrorReporting();

document.documentElement.dataset.motion = 'system';

// A file or link dropped outside a drop target would navigate the app window to it; see dropGuard.ts.
for (const name of ['dragover', 'drop'] as const) {
  document.addEventListener(name, (event) => {
    const types = Array.from(event.dataTransfer?.types ?? []);
    if (isForeignDrag(types)) event.preventDefault();
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

async function boot() {
  let language: AppLanguage = 'ru';
  try {
    const read = await window.electronAPI.getSettings();
    language = languageOf(read);
  } catch {
    language = 'ru';
  }
  startI18n(language);
  root.render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <MotionRoot>
          <HintProvider>
            <ToastProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </ToastProvider>
          </HintProvider>
        </MotionRoot>
      </I18nextProvider>
    </React.StrictMode>
  );
}

void boot();
