import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Base path for GitHub Pages deployment
  base: command === 'build' ? '/tor-hazae41/' : '/',

  server: {
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
    include: ['buffer', 'events'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },

  resolve: {
    alias: {
      buffer: 'buffer',
      events: 'events',
    },
  },
}));
