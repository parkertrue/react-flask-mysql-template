import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // The page's URL. src/test/setup.js stubs window.location with the same
    // origin, and MSW resolves relative handler paths against it, so the two
    // must agree for handlers to match the requests axios sends.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: './src/test/setup.js',
    exclude: [
      'node_modules/',
      '**/e2e/', 
      '**/*.config.{js,mjs}',
      '**/*.css'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/e2e/', 
        'src/test/',
        '**/*.config.{js,mjs}',
        '**/main.jsx',
        '**/*.css'
      ]
    },
    // React Testing Library's act() warnings are noise for async hooks
    onConsoleLog(log) {
      if (log.includes('was not wrapped in act')) {
        return false
      }
    }
  }
})