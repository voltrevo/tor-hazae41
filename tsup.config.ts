import { defineConfig } from 'tsup';

export default defineConfig({
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
});
