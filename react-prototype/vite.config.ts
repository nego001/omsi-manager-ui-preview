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
    transformIndexHtml: (html) => injectPackagedCSP(html),
    generateBundle() {
      // Actual Rollup module graph, not a text search of minified output.
      // Existing synthetic renderer demonstrations in src/ remain intentional.
      for (const id of this.getModuleIds()) {
        const normalized = id.replace(/\\/g, '/');
        if (/(?:^|\/)(?:scripts|native-lab|native-launcher|electron|tests|examples)\//.test(normalized.split('?')[0]) && !normalized.includes('/node_modules/')) {
          throw new Error('M101_RENDERER_LAB_IMPORT_REFUSED');
        }
      }
      console.log('M101_RENDERER_MODULE_GRAPH_CHECKED');
    }
  }]
});
