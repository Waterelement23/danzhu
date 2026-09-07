import { defineConfig } from 'vite';
export default defineConfig({
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
