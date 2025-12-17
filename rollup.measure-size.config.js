import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  input: 'dist/index.mjs',
  output: {
    file: 'dist/bundle-size-check.js',
    format: 'es',
  },
  external: ['fs/promises', 'path'],
  plugins: [
    nodeResolve({
      preferBuiltins: false,
      exportConditions: ['import', 'browser', 'default'],
    }),
    commonjs(),
    terser({
      compress: false,
      mangle: true,
      format: {
        comments: false,
      },
    }),
  ],
};
