import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: {
      js,
      prettier,
    },
    extends: ['js/recommended'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Style rules
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
  ...tseslint.configs.recommended,
  prettierConfig, // This must be last to override other formatting rules
]);
