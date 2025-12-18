import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const isBrowser = process.env.VITEST_BROWSER === 'true';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integrationTest.ts',
        'src/**/*.manualTest.ts',
        'src/**/example.ts',
        'node_modules',
      ],
      reporter: ['text-summary', 'html'],
    },
    ...(isBrowser && {
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [
          {
            browser: 'chromium',
          },
        ],
      },
      // Exclude tests that require Node.js APIs (fs, etc)
      exclude: [
        'node_modules',
        'dist',
        'src/storage/storage.test.ts',
        'src/storage/tsconfig-paths.test.ts',
      ],
    }),
  },
  resolve: {
    alias: {
      '~': '/src',
    },
  },
});
