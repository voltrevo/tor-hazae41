import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/TorClient/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    splitting: false,
    outDir: 'dist',
    target: 'es2022',
    treeshake: false,
    external: ['*'],
  },
  {
    entry: [
      'src/storage/index.ts',
      'src/storage/index-browser.ts',
      'src/storage/index-node.ts',
    ],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    splitting: false,
    outDir: 'dist/storage',
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.js',
      };
    },
    target: 'es2022',
    treeshake: false,
    external: ['node:fs/promises', 'node:path'],
  },
  {
    entry: ['curlTor.ts'],
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    minify: false,
    outDir: 'dist',
    target: 'es2022',
    treeshake: false,
    external: ['*'],
    shims: true,
    noExternal: ['./src/TorClient'],
  },
]);
