import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Base path for GitHub Pages deployment
  base: command === 'build' ? '/tor-js/' : '/',

  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173,
    open: !process.env.TEST_BROWSER,
  },

  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
  },

  define: {
    global: 'globalThis',
  },

  optimizeDeps: {
    exclude: ['@hazae41/echalote', '@hazae41/cadenas', '@hazae41/fleche'],
    include: ['events'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },

  resolve: {
    alias: {
      events: 'events',
      'tor-js/storage': '/src/storage/index-browser.ts',
    },
  },
}));
