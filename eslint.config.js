import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      // Licensed Bible source and its generated output — never authored here.
      'resources/**',
      'src/data/generated/**',
      'android/**',
    ],
  },

  js.configs.recommended,

  // Application code. `src/service-worker.js` runs in a worker scope, so both
  // sets of globals are granted to every module (they do not overlap harmfully).
  {
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },

  // ESM test suites: Playwright specs run in the browser context they create,
  // so they legitimately touch `document`, `localStorage` and friends inside
  // `page.evaluate` callbacks.
  {
    files: ['tests/**/*.{js,mjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // Build/extract scripts.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // Root config files: ESM…
  {
    files: ['playwright.config.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // …and CommonJS.
  {
    files: ['*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
];
