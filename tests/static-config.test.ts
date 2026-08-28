import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type StaticConfig = {
  globalHeaders: Record<string, string>;
  mimeTypes: Record<string, string>;
  routes: Array<{ route: string; headers: Record<string, string> }>;
};

describe('static-host response policy', () => {
  it('ships hardening headers, immutable hashed assets, and a manifest content type', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'public/staticwebapp.config.json'), 'utf8')) as StaticConfig;
    expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders['Content-Security-Policy']).toContain("connect-src 'self'");
    expect(config.globalHeaders['Permissions-Policy']).toContain('camera=()');
    expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
    expect(config.routes.find((route) => route.route === '/assets/*')?.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(config.mimeTypes['.webmanifest']).toBe('application/manifest+json');
    expect(config.routes.find((route) => route.route === '/manifest.webmanifest')?.headers['Content-Type']).toBe('application/manifest+json; charset=utf-8');
  });

  it('precache-discovers fingerprinted responsive artwork instead of stale public image paths', () => {
    const worker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
    expect(worker).toContain("const VERSION = 'pantry-v7'");
    expect(worker).toContain('src|href|srcset');
    expect(worker).not.toContain('/images/pantry-landscape');
  });

  it('does not ship a checkout or license-verification integration without an enabled billing product', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(app).not.toContain('api.sociobot.in');
    expect(app).not.toContain('/checkout');
    expect(app).not.toContain('sb_license:');
    expect(app).not.toContain('style="');
  });

  it('ships canonical and social metadata from original pantry artwork', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('rel="canonical" href="https://pantry-reconcile.sociobot.in/"');
    expect(html).toContain('property="og:image" content="https://pantry-reconcile.sociobot.in/social-preview.webp"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});
