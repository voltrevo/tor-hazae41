import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Read package version and commit hash
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const commitHash = execSync('git rev-parse --short=7 HEAD', {
  encoding: 'utf-8',
}).trim();

// Check for uncommitted changes
const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
const hasChanges = status.length > 0;
const changedSuffix = hasChanges ? '-changed' : '';

export default {
  input: 'dist/TorClient/versions/singleton.d.ts',
  output: {
    file: `dist-singleton/tor-js-singleton-${pkg.version}-${commitHash}${changedSuffix}.d.ts`,
    format: 'es',
  },
  plugins: [dts()],
};
