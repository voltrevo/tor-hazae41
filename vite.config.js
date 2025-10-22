import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Base path for GitHub Pages deployment
  base: command === 'build' ? '/tor-hazae41/' : '/',

  server: {
    port: 3000,
    open: true,
  },

  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
  },

  define: {
    global: 'globalThis',
    Buffer: 'Buffer',
  },

  optimizeDeps: {
    exclude: ['@hazae41/echalote', '@hazae41/cadenas', '@hazae41/fleche'],
    include: ['buffer'],
  },

  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
}));
