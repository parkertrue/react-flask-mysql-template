import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    exclude: [
      'node_modules/',
      '**/e2e/', 
      '**/*.config.js',
      '**/*.css'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/e2e/', 
        'src/test/',
        '**/*.config.js',
        '**/main.jsx',
        '**/*.css'
      ]
    },
    // Suppress console warnings during tests
    silent: false,
    onConsoleLog(log) {
      if (log.includes('was not wrapped in act')) {
        return false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})