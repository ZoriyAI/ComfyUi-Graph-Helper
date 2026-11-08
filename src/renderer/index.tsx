import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import { i18n, startI18n } from './i18n';
import MotionRoot from './motion/MotionRoot';
import { HintProvider } from './ui/Hint';
import { languageOf, type AppLanguage } from '../shared/i18n';
import '@fontsource/geist/400.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/cyrillic-400.css';
import '@fontsource/geist/cyrillic-600.css';
import './theme/tokens.css';
import './theme.css';

document.documentElement.dataset.motion = 'system';

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
            <App />
          </HintProvider>
        </MotionRoot>
      </I18nextProvider>
    </React.StrictMode>
  );
}

void boot();
