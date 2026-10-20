import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const noUnused = ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: { 'no-unused-vars': noUnused },
  },
  {
    files: ['**/*.jsx'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Browser specs: the assertions run inside the page, so the DOM globals
    // are legitimately referenced from the test file itself.
    files: ['tests/e2e/**/*.spec.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['public/landing.js', 'public/offline.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Service worker: runs in the SW global scope, not a page or Node.
    // Only the two SW-specific globals Workbox relies on; `window`/`document`
    // stay undefined so accidental DOM access is still caught.
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        RegExp: 'readonly',
        console: 'readonly',
      },
    },
  },
])
