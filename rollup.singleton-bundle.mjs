import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Read package version and LICENSE
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const license = readFileSync('LICENSE', 'utf-8');
const commitHash = execSync('git rev-parse --short=7 HEAD', {
  encoding: 'utf-8',
}).trim();

// Check for uncommitted changes
const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
const hasChanges = status.length > 0;
const changedSuffix = hasChanges ? '-changed' : '';

// Convert LICENSE to a JavaScript comment block
const licenseComment =
  '/*\n' +
  license
    .split('\n')
    .map(line => ' * ' + line)
    .join('\n') +
  '\n */';

export default {
  input: 'dist/TorClient/versions/singleton.mjs',
  output: {
    file: `dist-singleton/tor-js-singleton-${pkg.version}-${commitHash}${changedSuffix}/index.mjs`,
    format: 'es',
    sourcemap: false,
    banner: licenseComment,
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
