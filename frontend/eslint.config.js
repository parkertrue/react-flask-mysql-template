import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
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
    // Shared code never depends on a feature or a page, so deleting a
    // feature folder cannot break it
    files: ['src/{api,auth,components,utils}/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/features/*', '@/pages/*', '@/routes', '**/features/*', '**/pages/*'],
          message: 'Shared code must not import a feature or a page.',
        }],
      }],
    },
  },
  {
    // Build and test tooling runs under Node, not in the browser
    files: ['*.config.js', 'e2e/**'],
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
