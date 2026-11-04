import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.dependency-cruiser.cjs',
      '**/dist/**',
      '**/node_modules/**',
      'prototype-extrait/**',
      'docs/**',
      '**/*.tsbuildinfo',
      'apps/web/public/combat.js',
      'e2e/rapport/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly', URLSearchParams: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='innerHTML']", message: 'Pas de innerHTML (guide 13.1).' },
      ],
    },
  },
  {
    // Code du navigateur (rediffusion des combats).
    files: ['packages/ui-combat/src/**', 'apps/web/public/**'],
    languageOptions: {
      globals: {
        EventSource: 'readonly',
        CustomEvent: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        setTimeout: 'readonly',
        performance: 'readonly',
        matchMedia: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
  },
);
