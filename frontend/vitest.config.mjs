import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
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