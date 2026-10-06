import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    // Build and test tooling runs under Node, not in the browser
    files: ['*.config.{js,mjs}', 'e2e/**'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/__tests__/**', 'src/test/**', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
])
