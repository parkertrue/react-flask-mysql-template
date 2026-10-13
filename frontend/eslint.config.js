import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import vitest from '@vitest/eslint-plugin'
import playwright from 'eslint-plugin-playwright'
import { defineConfig, globalIgnores } from 'eslint/config'
import path from 'path'

// Each block below that restricts imports repeats this, since a later block
// replaces an earlier one's options for the same rule rather than adding to
// them: ./ within a folder, the @/ alias across folders
const NO_CLIMBING = {
  group: ['../../*'],
  message: 'Import from another folder with the @/ alias, not ../../',
}
const restrictImports = (...patterns) =>
  ({ 'no-restricted-imports': ['error', { patterns: [...patterns, NO_CLIMBING] }] })

// The same holds for no-restricted-syntax. These apply to every file in
// src/, and FORM_CONTROL to all but FormField's own folder.
const NO_TEXT_AS_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: 'Render text, which React escapes. User markup must be sanitized first (CLAUDE.md).',
}
const NO_TEST_IDS = {
  selector: "JSXAttribute[name.name='data-testid'], Identifier[name=/ByTestId$/]",
  message: 'Find elements by role, label or text: production markup has no data-testid.',
}
const NO_DISABLED = {
  selector: "JSXAttribute[name.name='disabled']",
  message: 'disabled drops keyboard focus: mark a busy control aria-disabled or readOnly and guard its handler.',
}
const NO_MOCKED_STORAGE = {
  selector: "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=/(^|[^a-zA-Z])storage$/]",
  message: 'Tests use the real localStorage (signIn() for a session), never a mocked storage.',
}
const FORM_CONTROL = {
  selector: 'JSXOpeningElement[name.name=/^(input|textarea|select)$/]',
  message: 'Use FormField (src/components/forms) instead of a raw form control.',
}
const restrictSyntax = (...selectors) => ({
  'no-restricted-syntax': ['error', NO_TEXT_AS_HTML, NO_TEST_IDS, NO_DISABLED, NO_MOCKED_STORAGE, ...selectors],
})

// The folder a file belongs to: a feature (features/notes), a top-level
// folder of src/ (auth, pages, ...), or src/ itself for its root files.
// A __tests__ folder belongs to the folder it sits in.
const SRC = path.join(import.meta.dirname, 'src')
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
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    // Debug output and temporary markers stay out of shipped code
    // (`debugger` is already an error in js.configs.recommended), and so
    // does running a string as code
    rules: {
      'no-console': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'hack', 'xxx', 'nocommit'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['src/**'],
    plugins: { local: { rules: { 'relative-within-folder': relativeWithinFolder } } },
    rules: {
      ...restrictImports(),
      ...restrictSyntax(FORM_CONTROL),
      'local/relative-within-folder': 'error',
    },
  },
  {
    // Fields go through FormField, which ties the label, hint and message to
    // the input for screen readers. Only it renders a raw form control
    files: ['src/components/forms/**'],
    rules: restrictSyntax(),
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
    files: ['src/**/__tests__/**', 'src/test/**', '**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Every assertion must be able to fail: none behind an if or in a catch,
    // none that almost any value passes, and no test without one, skipped
    // or focused (backend: tests/unit/test_assertions.py). The presets ship
    // some rules as warnings, which `npm run lint` fails on too
    files: ['src/**/*.{test,spec}.{js,jsx}'],
    extends: [vitest.configs.recommended],
    rules: {
      'vitest/no-conditional-expect': 'error',
      'vitest/no-restricted-matchers': ['error', {
        toBeDefined: 'Assert the value itself.',
        toBeTruthy: 'Assert the value itself.',
        toBeFalsy: 'Assert the value itself.',
        'not.toBeNull': 'Assert the value itself.',
        'not.toBeUndefined': 'Assert the value itself.',
        toBeOneOf: 'Pin the one answer the code gives.',
      }],
    },
  },
  {
    files: ['e2e/**/*.spec.js'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // e2e/helpers.js's expect* helpers (expectNoViolations, ...) assert too
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
      'playwright/no-conditional-expect': 'error',
      'playwright/no-conditional-in-test': 'error',
    },
  },
])
