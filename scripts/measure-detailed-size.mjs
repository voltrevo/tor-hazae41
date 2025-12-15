#!/usr/bin/env node

import { execSync } from 'child_process';
import {
  readFileSync,
  existsSync,
  readdirSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = dirname(__dirname);

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function findDependenciesInSource(distMjsPath) {
  // Read the unminified source file and find all external dependencies
  let content;
  try {
    content = readFileSync(distMjsPath, 'utf8');
  } catch {
    return [];
  }

  const importPattern = /import\s+(?:{[^}]*}|.*?)\s+from\s+["']([^"']+)["']/g;
  const depSet = new Set();

  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const importPath = match[1];

    // Skip relative imports and node built-ins
    if (
      importPath.startsWith('.') ||
      importPath === 'fs' ||
      importPath === 'path' ||
      importPath === 'node:fs' ||
      importPath === 'node:fs/promises' ||
      importPath === 'node:path'
    )
      continue;

    // Extract package name
    let depName = importPath;
    if (importPath.includes('/')) {
      const parts = importPath.split('/');
      depName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    }

    depSet.add(depName);
  }

  return Array.from(depSet).sort();
}

async function bundleWithExternalPlugin(variation, excludedDeps = []) {
  const distInput = `dist/TorClient/versions/${variation}.mjs`;
  const bundleOutput = `dist/bundle-size-check-${variation}-temp.js`;

  // Create external plugin to exclude specified dependencies
  const externalPlugin = `
import baseConfig from '${join(projectRoot, 'rollup.measure-size.config.js')}';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const excludedDeps = ${JSON.stringify(excludedDeps)};

const externalPlugin = {
  name: 'exclude-deps',
  resolveId(id) {
    if (excludedDeps.some(dep => id === dep || id.startsWith(dep + '/'))) {
      return { id, external: true };
    }
  }
};

export default {
  ...baseConfig,
  input: '${distInput}',
  output: {
    ...baseConfig.output,
    file: '${bundleOutput}',
  },
  external: (id) => excludedDeps.some(dep => id === dep || id.startsWith(dep + '/')),
  plugins: [
    externalPlugin,
    ...(baseConfig.plugins || [])
  ]
};
`;

  const tempConfigPath = join(
    projectRoot,
    `.rollup-temp-${variation}-${excludedDeps.join('_').replace(/\//g, '-')}.mjs`
  );
  writeFileSync(tempConfigPath, externalPlugin);

  try {
    execSync(`npx rollup -c ${tempConfigPath}`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
  } catch {
    // Ignore - this is expected to fail for excluded deps
  }

  let result = null;
  const bundlePath = join(projectRoot, bundleOutput);

  if (existsSync(bundlePath)) {
    try {
      const content = readFileSync(bundlePath, 'utf8');
      const plainSize = Buffer.byteLength(content, 'utf8');
      const gzipped = gzipSync(content);
      const gzipSize = gzipped.length;

      result = { plainSize, gzipSize };
    } catch {
      // Ignore
    }

    unlinkSync(bundlePath);
  }

  unlinkSync(tempConfigPath);
  return result;
}

async function bundleFull(variation) {
  const distInput = `dist/TorClient/versions/${variation}.mjs`;
  const bundleOutput = `dist/bundle-size-check-${variation}.js`;
  const configPath = join(projectRoot, 'rollup.measure-size.config.js');

  const rollupConfig = `
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import baseConfig from '${configPath}';

export default {
  ...baseConfig,
  input: '${distInput}',
  output: {
    ...baseConfig.output,
    file: '${bundleOutput}',
  },
};
`;

  const tempConfigPath = join(projectRoot, `.rollup-temp-${variation}.mjs`);
  writeFileSync(tempConfigPath, rollupConfig);

  try {
    execSync(`npx rollup -c ${tempConfigPath}`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
  } catch (error) {
    if (!existsSync(join(projectRoot, bundleOutput))) {
      console.error(`❌ Rollup bundling failed for ${variation}`);
      unlinkSync(tempConfigPath);
      throw error;
    }
  }

  const bundlePath = join(projectRoot, bundleOutput);
  const content = readFileSync(bundlePath, 'utf8');
  const plainSize = Buffer.byteLength(content, 'utf8');
  const gzipped = gzipSync(content);
  const gzipSize = gzipped.length;

  unlinkSync(tempConfigPath);

  return { plainSize, gzipSize, bundlePath };
}

async function measureSize() {
  // Build the library first
  console.log('🔨 Building library...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
  } catch {
    console.error('❌ Build failed');
    process.exit(1);
  }

  // Get all variation files from src/TorClient/versions
  const versionsDir = join(projectRoot, 'src/TorClient/versions');
  const versionFiles = readdirSync(versionsDir)
    .filter(file => file.endsWith('.ts'))
    .map(file => file.replace('.ts', ''));

  console.log(
    `\n📦 Found ${versionFiles.length} variation(s): ${versionFiles.join(', ')}\n`
  );

  const results = [];

  for (const variation of versionFiles) {
    console.log(`📦 Analyzing ${variation}...\n   Building full bundle...`);

    // Build the full bundle
    const fullBundle = await bundleFull(variation);

    // Find dependencies in source
    const distMjsPath = join(
      projectRoot,
      `dist/TorClient/versions/${variation}.mjs`
    );
    const dependencies = findDependenciesInSource(distMjsPath);

    console.log(`   Found ${dependencies.length} dependencies to analyze...`);

    // Build bundle without each dependency and measure the difference
    const depImpacts = [];

    for (const dep of dependencies) {
      process.stdout.write(`   Testing ${dep}...`);

      const withoutDep = await bundleWithExternalPlugin(variation, [dep]);

      if (withoutDep) {
        const rawDiff = fullBundle.plainSize - withoutDep.plainSize;
        const gzipDiff = fullBundle.gzipSize - withoutDep.gzipSize;

        if (rawDiff > 0) {
          depImpacts.push({
            name: dep,
            rawBytes: rawDiff,
            gzipBytes: gzipDiff,
          });
          console.log(
            ` ${formatSize(rawDiff)} (gzip: ${formatSize(gzipDiff)})`
          );
        } else {
          console.log(' (tree-shaken)');
        }
      } else {
        console.log(' (skip)');
      }
    }

    // Sort by impact
    depImpacts.sort((a, b) => b.rawBytes - a.rawBytes);

    results.push({
      variation,
      fullBundleRaw: fullBundle.plainSize,
      fullBundleGzip: fullBundle.gzipSize,
      depImpacts,
    });
  }

  // Output results
  console.log('\n\n📊 Dependency Size Impact Report\n');
  console.log('═'.repeat(90));

  for (const result of results) {
    console.log(`\n${result.variation}:`);
    console.log(
      `  Full Bundle: ${formatSize(result.fullBundleRaw)} raw (${result.fullBundleRaw.toLocaleString()} bytes)`
    );
    console.log(
      `              ${formatSize(result.fullBundleGzip)} gzip (${result.fullBundleGzip.toLocaleString()} bytes)`
    );

    if (result.depImpacts.length > 0) {
      console.log('\n  📦 Dependency Impact (sorted by raw size):');
      console.log('  ' + '─'.repeat(86));
      console.log(
        '  Package                              Raw Size       Gzip Size     % of Total'
      );
      console.log('  ' + '─'.repeat(86));

      for (const dep of result.depImpacts) {
        const pctRaw = ((dep.rawBytes / result.fullBundleRaw) * 100).toFixed(2);
        console.log(
          `  ${dep.name.padEnd(35)} ${formatSize(dep.rawBytes).padStart(12)}  ${formatSize(dep.gzipBytes).padStart(12)}  ${pctRaw.padStart(5)}%`
        );
      }

      const totalDeps = result.depImpacts.reduce(
        (sum, d) => sum + d.rawBytes,
        0
      );
      const totalDepsGzip = result.depImpacts.reduce(
        (sum, d) => sum + d.gzipBytes,
        0
      );
      const localCode = result.fullBundleRaw - totalDeps;
      const localCodeGzip = result.fullBundleGzip - totalDepsGzip;

      console.log('  ' + '─'.repeat(86));
      console.log(
        `  Local code                           ${formatSize(localCode).padStart(12)}  ${formatSize(localCodeGzip).padStart(12)}  ${((localCode / result.fullBundleRaw) * 100).toFixed(2).padStart(5)}%`
      );
      console.log(
        `  Dependencies total                   ${formatSize(totalDeps).padStart(12)}  ${formatSize(totalDepsGzip).padStart(12)}  ${((totalDeps / result.fullBundleRaw) * 100).toFixed(2).padStart(5)}%`
      );
    }
  }

  console.log('\n' + '═'.repeat(90));
  console.log('✅ Analysis complete\n');
}

measureSize().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
