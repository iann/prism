import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: `${projectRoot}/solar-harness`,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${projectRoot}/src`,
    },
  },
  build: {
    outDir: `${projectRoot}/dist/solar-harness`,
    emptyOutDir: true,
  },
});
