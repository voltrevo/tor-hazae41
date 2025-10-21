import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext'
  },
  define: {
    global: 'globalThis',
    // Add Buffer polyfill
    Buffer: 'Buffer'
  },
  optimizeDeps: {
    exclude: ['@hazae41/echalote', '@hazae41/cadenas', '@hazae41/fleche'],
    include: ['buffer']
  },
  // Add polyfills for Node.js globals
  resolve: {
    alias: {
      buffer: 'buffer',
    }
  }
})