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

async function measureSize() {
  const results = [];

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

  // Measure each variation
  for (const variation of versionFiles) {
    console.log(`📦 Bundling variation: ${variation}...`);

    const distInput = `dist/TorClient/versions/${variation}.mjs`;
    const bundleOutput = `dist/bundle-size-check-${variation}.js`;

    // Create a temporary rollup config for this variation that extends the base config
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

    // Write temporary config file
    const tempConfigPath = join(projectRoot, `.rollup-temp-${variation}.mjs`);
    writeFileSync(tempConfigPath, rollupConfig);

    try {
      execSync(`npx rollup -c ${tempConfigPath}`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch (error) {
      // Rollup may exit with non-zero even on success due to warnings
      // Check if file was created
      if (!existsSync(join(projectRoot, bundleOutput))) {
        console.error(`❌ Rollup bundling failed for ${variation}`);
        unlinkSync(tempConfigPath);
        process.exit(1);
      }
    }

    // Read the bundled file
    const bundlePath = join(projectRoot, bundleOutput);
    let bundleContent;

    try {
      bundleContent = readFileSync(bundlePath, 'utf8');
    } catch {
      console.error(`❌ Could not read bundle at ${bundlePath}`);
      unlinkSync(tempConfigPath);
      process.exit(1);
    }

    // Calculate sizes
    const plainSize = Buffer.byteLength(bundleContent, 'utf8');
    const gzippedContent = gzipSync(bundleContent);
    const gzippedSize = gzippedContent.length;

    results.push({
      variation,
      plainSize,
      gzippedSize,
      bundleOutput,
    });

    // Cleanup temp config
    unlinkSync(tempConfigPath);
  }

  // Output all results together
  console.log('\n\n📊 Browser Bundle Size Report (with all dependencies)\n');
  console.log('═'.repeat(70));

  for (const result of results) {
    const ratio = ((result.gzippedSize / result.plainSize) * 100).toFixed(1);
    console.log(`\n${result.variation}:`);
    console.log(`  Bundle: ${result.bundleOutput} (browser IIFE)`);
    console.log(
      `  Plain:  ${formatSize(result.plainSize)} (${result.plainSize.toLocaleString()} bytes)`
    );
    console.log(
      `  Gzip:   ${formatSize(result.gzippedSize)} (${result.gzippedSize.toLocaleString()} bytes)`
    );
    console.log(`  Ratio:  ${ratio}% of original size`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Size measurement complete\n');
}

measureSize().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
