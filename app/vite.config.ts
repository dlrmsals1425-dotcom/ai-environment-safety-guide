import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { naverGeocodePlugin } from './src/server/naverGeocodeProxy';

type MiddlewareLayer = {
  use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void }, next: () => void) => void) => void;
};

function rejectMissingPublicData() {
  const attach = (publicDir: string, middlewares: MiddlewareLayer) => {
    middlewares.use((req, res, next) => {
      const urlPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
      if (!urlPath.startsWith('/data/')) {
        next();
        return;
      }
      const rel = urlPath.slice(1).replaceAll('\\', '/');
      const file = path.resolve(publicDir, rel);
      const root = path.resolve(publicDir);
      if (!file.startsWith(root + path.sep) && file !== root) {
        next();
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not found');
        return;
      }
      next();
    });
  };
  return {
    name: 'reject-missing-public-data',
    configureServer(server) {
      attach(server.config.publicDir, server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.config.publicDir, server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [
    rejectMissingPublicData(),
    naverGeocodePlugin(fileURLToPath(new URL('.', import.meta.url))),
    react(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    // Windows + Node 24에서 Vite emptyOutDir가 dist 삭제 중 비정상 종료하는 경우가 있어 끈다.
    emptyOutDir: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
