import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'graphify-out/', 'test-results/', 'playwright-report/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  { files: ['tests/**/*.ts'], languageOptions: { globals: { process: 'readonly' } } },
  { files: ['public/sw.js'], languageOptions: { globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' } } },
);
