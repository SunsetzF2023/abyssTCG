import js from '@eslint/js';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Math: 'readonly',
  alert: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js', 'vite.config.js', 'vitest.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
