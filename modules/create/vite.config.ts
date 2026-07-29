import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/create/',
  root: rootDir,
  publicDir: false,
  build: {
    outDir: resolve(rootDir, '../../public/create'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api/create-chat': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
