import { ESLint } from 'eslint'

// The import rules are config, and config fails silently: a later block
// replaces an earlier one's options, and a rule that stops matching reports
// nothing. These plant imports in made-up files and lint them with the real
// eslint.config.js, as tests/unit/test_import_rules.py does for the backend.
const eslint = new ESLint()

const ruleIds = async (filePath, code) => {
  const [result] = await eslint.lintText(`${code}\n`, { filePath })
  return result.messages.map(message => message.ruleId)
}

describe('import rules', () => {
  it.each([
    // A relative path that leaves its folder, however it is written
    ['src/features/notes/x.js', "import '../health/useHealth'", 'local/relative-within-folder'],
    ['src/auth/x.js', "import '../routes'", 'local/relative-within-folder'],
    ['src/auth/x.js', "export * from '../features/notes/useNotes'", 'local/relative-within-folder'],
    ['src/utils/x.js', "import('../pages/HomePage')", 'local/relative-within-folder'],
    ['src/routes.jsx', "import './pages/HomePage'", 'local/relative-within-folder'],
    ['src/components/layout/x.js', "import '../../features/notes/useNotes'", 'no-restricted-imports'],
    // The one-way rules on the @/ alias
    ['src/utils/x.js', "import '@/features/notes/useNotes'", 'no-restricted-imports'],
    ['src/auth/x.js', "import '@/routes'", 'no-restricted-imports'],
    ['src/components/x.js', "import '@/pages/HomePage'", 'no-restricted-imports'],
    ['src/features/notes/x.js', "import '@/features/health/useHealth'", 'no-restricted-imports'],
    ['src/features/notes/x.js', "import '@/pages/HomePage'", 'no-restricted-imports'],
    ['src/features/notes/x.js', "import '@/routes'", 'no-restricted-imports'],
    ['src/features/notes/__tests__/x.js', "import '@/features/health/useHealth'", 'no-restricted-imports'],
  ])('refuses %s: %s', async (filePath, code, ruleId) => {
    expect(await ruleIds(filePath, code)).toContain(ruleId)
  })

  it.each([
    ['src/features/notes/x.js', "import './useNotes'"],
    ['src/features/notes/x.js', "import '@/auth/useAuth'"],
    ['src/features/notes/__tests__/x.js', "import '../useNotes'"],
    ['src/features/notes/__tests__/x.js', "import '@/routes'"],
    ['src/components/layout/x.js', "import '../forms/FormField'"],
    ['src/test/integration/x.js', "import '../fixtures'"],
    ['src/__tests__/x.js', "import '../routes'"],
    ['src/pages/x.js', "import '@/features/notes/NotesPage'"],
  ])('allows %s: %s', async (filePath, code) => {
    expect(await ruleIds(filePath, code)).toEqual([])
  })
})
