import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import vitest from '@vitest/eslint-plugin'
import playwright from 'eslint-plugin-playwright'
import { defineConfig, globalIgnores } from 'eslint/config'

// Each block below that restricts imports repeats this, since a later block
// replaces an earlier one's options for the same rule rather than adding to
// them: ./ within a folder, the @/ alias across folders
const NO_CLIMBING = {
  group: ['../../*'],
  message: 'Import from another folder with the @/ alias, not ../../',
}
const restrictImports = (...patterns) =>
  ({ 'no-restricted-imports': ['error', { patterns: [...patterns, NO_CLIMBING] }] })

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
    files: ['src/**'],
    rules: restrictImports(),
  },
  {
    // Shared code never depends on a feature or a page, so deleting a
    // feature folder cannot break it
    files: ['src/{api,auth,components,utils}/**'],
    rules: restrictImports({
      group: ['@/features/*', '@/pages/*', '@/routes', '**/features/*', '**/pages/*'],
      message: 'Shared code must not import a feature or a page.',
    }),
  },
  {
    // Nor does one feature depend on another, so each can be deleted alone.
    // Its own files it imports with ./
    files: ['src/features/**'],
    rules: restrictImports({
      group: ['@/features/*', '@/pages/*', '@/routes', '**/pages/*'],
      message: 'A feature must not import another feature, a page or the routes.',
    }),
  },
  {
    // A feature's tests may render the whole app around it
    files: ['src/features/**/__tests__/**'],
    rules: restrictImports({
      group: ['@/features/*', '@/pages/*', '**/pages/*'],
      message: 'A feature must not import another feature or a page.',
    }),
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
  {
    // Every assertion must be able to fail: none behind an if or in a catch,
    // and no test without one (backend: tests/unit/test_assertions.py)
    files: ['src/**/*.test.{js,jsx}'],
    plugins: { vitest },
    rules: {
      'vitest/expect-expect': 'error',
      'vitest/no-conditional-expect': 'error',
    },
  },
  {
    files: ['e2e/**/*.spec.js'],
    plugins: { playwright },
    rules: {
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-conditional-in-test': 'error',
    },
  },
])
