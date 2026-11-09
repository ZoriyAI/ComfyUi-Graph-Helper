import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev server only: React refresh injects an inline module script and HMR talks over a websocket, so the
 * strict policy in index.html is relaxed for `vite serve`. Built files keep the strict policy unchanged.
 */
function devContentSecurityPolicy(): Plugin {
  return {
    name: 'dev-content-security-policy',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
        .replace("connect-src 'self';", "connect-src 'self' ws://localhost:5173 http://localhost:5173;");
    },
  };
}

export default defineConfig({
  plugins: [react(), devContentSecurityPolicy()],
  base: './',
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
