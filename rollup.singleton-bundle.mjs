import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'dist/TorClient/versions/singleton.mjs',
  output: {
    file: 'dist-singleton/tor.mjs',
    format: 'es',
    sourcemap: false,
  },
  // Only externalize native Node.js modules
  external: [
    'fs/promises',
    'path',
    'fs',
    'os',
    'node:fs',
    'node:fs/promises',
    'node:path',
    'node:os',
  ],
  plugins: [
    nodeResolve({
      // Bundle all npm packages, don't prefer Node.js built-ins
      preferBuiltins: false,
      // Use default export conditions for ESM
      exportConditions: ['import', 'default'],
    }),
    commonjs(),
  ],
};
