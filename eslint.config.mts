import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import { defineConfig } from 'eslint/config';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig([
  {
    ignores: ['bundled-builds/**', 'dist/**', 'node_modules/**', '.next/**'],
  },
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  tseslint.configs.eslintRecommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: {
      prettier,
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Style rules
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      // Prettier integration
      'prettier/prettier': 'error',

      // TypeScript rules
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Allow #class pattern for nominal typing
      'no-unused-private-class-members': 'off',

      // Import rules - detect imports from packages not declared in package.json
      'import/no-extraneous-dependencies': 'error',
    },
  },
  prettierConfig, // This must be last to override other formatting rules
]);
