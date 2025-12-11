#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = dirname(__dirname);

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function measureSize() {
  console.log('\n📦 Measuring browser bundle size for end users...\n');

  // Build the library first
  console.log('🔨 Building library...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
  } catch {
    console.error('❌ Build failed');
    process.exit(1);
  }

  // Bundle for browser with dependencies
  console.log('\n📦 Bundling for browser with dependencies...');
  try {
    execSync(
      'npx rollup -c rollup.measure-size.config.js 2>&1 | grep -v "MODULE_TYPELESS_PACKAGE_JSON" | grep -v "Circular dependencies"',
      {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: '/bin/bash',
      }
    );
  } catch {
    // Some warnings are expected, check if file was created
    const bundleExists = existsSync(`${projectRoot}/dist/bundle-size-check.js`);
    if (!bundleExists) {
      console.error('❌ Rollup bundling failed - bundle file not created');
      process.exit(1);
    }
  }

  // Read the bundled file
  const bundlePath = `${projectRoot}/dist/bundle-size-check.js`;
  let bundleContent;

  try {
    bundleContent = readFileSync(bundlePath, 'utf8');
  } catch {
    console.error(`❌ Could not read bundle at ${bundlePath}`);
    process.exit(1);
  }

  // Calculate sizes
  const plainSize = Buffer.byteLength(bundleContent, 'utf8');
  const gzippedContent = gzipSync(bundleContent);
  const gzippedSize = gzippedContent.length;

  console.log('\n📊 Browser Bundle Size Report (with all dependencies)\n');
  console.log(`Bundle: dist/bundle-size-check.js (browser IIFE)`);
  console.log(
    `Plain:  ${formatSize(plainSize)} (${plainSize.toLocaleString()} bytes)`
  );
  console.log(
    `Gzip:   ${formatSize(gzippedSize)} (${gzippedSize.toLocaleString()} bytes)`
  );

  const ratio = ((gzippedSize / plainSize) * 100).toFixed(1);
  console.log(`Ratio:  ${ratio}% of original size\n`);

  console.log('✅ Size measurement complete\n');
}

measureSize().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
