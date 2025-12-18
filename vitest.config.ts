import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const isBrowser = process.env.VITEST_BROWSER === 'true';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
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
        provider: playwright({
          launchOptions: {
            headless: true,
          },
        }),
        instances: [
          {
            browser: 'chromium',
          },
        ],
      },
    }),
  },
  resolve: {
    alias: {
      '~': '/src',
    },
  },
});
