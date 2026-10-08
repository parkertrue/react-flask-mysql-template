import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // localhost only: the dev server proxies to Flask in debug mode, whose
    // tracebacks should not be reachable from the LAN. Opt in to LAN access
    // with `npm run dev -- --host`.
    host: 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // The page's URL. src/test/setup.js stubs window.location with the same
    // origin, and MSW resolves relative handler paths against it, so the two
    // must agree for handlers to match the requests axios sends.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: './src/test/setup.js',
    // Before each test, every mock loses the return values and
    // implementations an earlier test gave it, so no test depends on
    // another having run first. Stubbed globals are put back too.
    mockReset: true,
    unstubGlobals: true,
    // A new order every run, so a test leaning on another's leftovers fails
    // at once. Replay a failing order with --sequence.seed=<seed>.
    sequence: { shuffle: true },
    exclude: [
      'node_modules/',
      '**/e2e/',
      '**/*.config.js',
      '**/*.css'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Without include, a file no test imports is left out of the report
      // rather than counted as 0%, so an untested new file goes unnoticed.
      include: ['src/**/*.{js,jsx}'],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
      // Test files are left out automatically
      exclude: ['src/test/**', 'src/main.jsx']
    },
  }
})
