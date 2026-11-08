import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MotionRoot from './motion/MotionRoot';
import { HintProvider } from './ui/Hint';
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

root.render(
  <React.StrictMode>
    <MotionRoot>
      <HintProvider>
        <App />
      </HintProvider>
    </MotionRoot>
  </React.StrictMode>
);
