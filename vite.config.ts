import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  build: { target: 'es2022', sourcemap: true },
  server: { host: '127.0.0.1' },
  plugins: [{
    name: 'preview-real-404',
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' || !request.headers.accept?.includes('text/html')) { next(); return; }
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/$/, '') || '/';
        if (['/', '/demo', '/privacy', '/terms', '/index.html'].includes(pathname)) { next(); return; }
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(readFileSync(resolve(process.cwd(), 'dist/404.html')));
      });
    },
  }],
});
