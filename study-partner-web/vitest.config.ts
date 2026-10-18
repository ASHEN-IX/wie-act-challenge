import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/screens'),
      '@ui': path.resolve(__dirname, './src/components/ui'),
      '@api': path.resolve(__dirname, './src/api'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@context': path.resolve(__dirname, './src/context'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      path.resolve(
        __dirname,
        './src',
        require('fs').existsSync(path.resolve(__dirname, './src/setupTests.ts'))
          ? 'setupTests.ts'
          : 'setupTests.js'
      )
    ],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    maxWorkers: 2,
    isolate: true,
    testTimeout: 10000,
  },
})
