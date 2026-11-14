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
    // The bundle loads from local disk (file://), not over a network: one ~1.8 MB chunk costs little, and the
    // packaged app is usable about 1.2 s after start. Raised so the warning means something again; splitting the
    // lessons, the model log and the settings dialog into their own chunks is the next step if it ever matters.
    chunkSizeWarningLimit: 2200,
  },
  server: {
    port: 5173,
  },
});
