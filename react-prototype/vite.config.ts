import { defineConfig } from 'vite';
import { injectPackagedCSP } from './scripts/packaged-content-security.mjs';

// Built file:// renderer must have a CSP; the unpackaged Vite dev server
// retains its HMR websocket without weakening the packaged policy.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', strictPort: true },
  plugins: [{
    name: 'omsi-packaged-content-security',
    apply: 'build',
    enforce: 'pre',
    transformIndexHtml: (html) => injectPackagedCSP(html)
  }]
});
