/** @type {import('eslint').Linter.Config[]} */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'voiceroom/',
      'crates/',
      'dist/',
      '*.min.js',
      'pnpm-lock.yaml',
      'package-lock.json',
      'db/',
      'dev-server.js',
      'db-push.js',
    ],
  },
  js.configs.recommended,
  prettier,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        API: 'readonly',
        LibertyDMUnreadStore: 'readonly',
        React: 'readonly',
        ReactDOM: 'readonly',
        rel: 'writable',
        room: 'writable',
        openMentionPopover: 'readonly',
      },
    },
    rules: {
      'no-undef': ['warn', { typeof: true }],
    },
  },
];
