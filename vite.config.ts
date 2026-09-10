import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const model = readFileSync(new URL('./public/models/refined-courtyard.glb', import.meta.url));
const modelVersion = createHash('sha256').update(model).digest('hex').slice(0, 12);
const base = process.env.VITE_BASE_PATH || '/';
export default defineConfig({
  base,
  plugins: [
    {
      name: 'courtyard-preload',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
          html
            .replace('__COURTYARD_URL__', `${base}models/refined-courtyard.glb?v=${modelVersion}`)
            .replace('__COURTYARD_BYTES__', String(model.length)),
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/matchmake': 'http://127.0.0.1:2567',
      '/health': 'http://127.0.0.1:2567',
      '/rooms': { target: 'ws://127.0.0.1:2567', ws: true },
    },
  },
  build: { outDir: 'dist/client', chunkSizeWarningLimit: 2200 },
});
