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
    // Debug output stays out of shipped code (`debugger` is already an
    // error in js.configs.recommended)
    rules: {
      'no-console': 'error',
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
    // Fields go through FormField, which ties the label, hint and message to
    // the input for screen readers
    files: ['src/**/*.jsx'],
    ignores: ['src/components/forms/**'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'JSXOpeningElement[name.name=/^(input|textarea|select)$/]',
        message: 'Use FormField (src/components/forms) instead of a raw form control.',
      }],
    },
  },
  {
    // Build and test tooling runs under Node, not in the browser
    files: ['*.config.js', 'e2e/**'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/__tests__/**', 'src/test/**', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      'no-console': 'off',
    },
  },
])
