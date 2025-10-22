import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Base path for GitHub Pages deployment
  // Will be '/' for local development and '/tor-hazae41/' for GitHub Pages
  base: command === 'build' ? '/tor-hazae41/' : '/',

  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps for smaller build size
  },
  define: {
    global: 'globalThis',
    // Add Buffer polyfill
    Buffer: 'Buffer',
  },
  optimizeDeps: {
    exclude: ['@hazae41/echalote', '@hazae41/cadenas', '@hazae41/fleche'],
    include: ['buffer'],
  },
  // Add polyfills for Node.js globals
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
}));
