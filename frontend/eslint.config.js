import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import vitest from '@vitest/eslint-plugin'
import playwright from 'eslint-plugin-playwright'
import { defineConfig, globalIgnores } from 'eslint/config'
import path from 'path'
import { fileURLToPath } from 'url'

// Each block below that restricts imports repeats this, since a later block
// replaces an earlier one's options for the same rule rather than adding to
// them: ./ within a folder, the @/ alias across folders
const NO_CLIMBING = {
  group: ['../../*'],
  message: 'Import from another folder with the @/ alias, not ../../',
}
const restrictImports = (...patterns) =>
  ({ 'no-restricted-imports': ['error', { patterns: [...patterns, NO_CLIMBING] }] })

// The folder a file belongs to: a feature (features/notes), a top-level
// folder of src/ (auth, pages, ...), or src/ itself for its root files.
// A __tests__ folder belongs to the folder it sits in.
const SRC = fileURLToPath(new URL('./src', import.meta.url))
const folderOf = file => {
  const parts = path.relative(SRC, file).split(path.sep).filter(part => part !== '__tests__')
  if (parts[0] === '..') return null
  if (parts.length === 1) return '.'
  return parts[0] === 'features' ? parts.slice(0, 2).join('/') : parts[0]
}

// no-restricted-imports only matches the text of a path, so a relative one
// such as ../health/useHealth or ../routes could reach another folder
// unseen. This resolves it instead: a relative import must stay in its
// folder, which leaves the @/ alias, and the rules on it below, as the only
// way across.
const relativeWithinFolder = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const from = folderOf(context.filename)
    const check = source => {
      if (from === null || typeof source?.value !== 'string' || !source.value.startsWith('.')) return
      const target = path.resolve(path.dirname(context.filename), source.value)
      if (folderOf(target) !== from) {
        context.report({ node: source, message: 'Import from another folder with the @/ alias.' })
      }
    }
    return {
      ImportDeclaration: node => check(node.source),
      ExportNamedDeclaration: node => check(node.source),
      ExportAllDeclaration: node => check(node.source),
      ImportExpression: node => check(node.source),
    }
  },
}

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
    plugins: { local: { rules: { 'relative-within-folder': relativeWithinFolder } } },
    rules: {
      ...restrictImports(),
      'local/relative-within-folder': 'error',
    },
  },
  {
    // Shared code never depends on a feature or a page, so deleting a
    // feature folder cannot break it
    files: ['src/{api,auth,components,utils}/**'],
    rules: restrictImports({
      group: ['@/features/*', '@/pages/*', '@/routes'],
      message: 'Shared code must not import a feature or a page.',
    }),
  },
  {
    // Nor does one feature depend on another, so each can be deleted alone.
    // Its own files it imports with ./
    files: ['src/features/**'],
    rules: restrictImports({
      group: ['@/features/*', '@/pages/*', '@/routes'],
      message: 'A feature must not import another feature, a page or the routes.',
    }),
  },
  {
    // A feature's tests may render the whole app around it
    files: ['src/features/**/__tests__/**'],
    rules: restrictImports({
      group: ['@/features/*', '@/pages/*'],
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
