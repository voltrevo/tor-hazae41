#!/usr/bin/env npx tsx
/**
 * Integration test for ccadbDynamic.ts
 *
 * Fetches certificates from each source and reports:
 * - How many certs matched the whitelist
 * - How many whitelisted certs were NOT found in this source
 * - How many unrecognized certs were found (not in whitelist)
 */

import { CCadbDynamic } from './ccadbDynamic.js';

async function runIntegrationTest() {
  console.log('=== CCADB Dynamic Integration Test ===\n');

  const sources: Array<'curl' | 'ccadb' | 'certifi'> = [
    'curl',
    'ccadb',
    'certifi',
  ];

  for (const source of sources) {
    try {
      console.log(`Testing ${source}...`);
      const result = await CCadbDynamic.fetchAndValidateCerts(source);

      const matched = result.matched.length;
      const notFound = result.notFound;
      const unrecognized = result.unrecognized.length;

      console.log(`  ✅ Matched:       ${matched}`);
      if (notFound > 0) {
        console.log(`  ⚠️  Not found:    ${notFound} (from whitelist)`);
      }
      if (unrecognized > 0) {
        console.log(`  ⚠️  Unrecognized: ${unrecognized} (not in whitelist)`);
      }
      console.log();
    } catch (error) {
      console.log(
        `  ❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
      console.log();
    }
  }

  console.log('=== Testing fallback chain ===\n');
  try {
    const certs = await CCadbDynamic.getDynamicBase64();
    console.log(`✅ Successfully fetched ${certs.length} certificates`);
  } catch (error) {
    console.log(
      `❌ Failed to fetch any certificates: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

runIntegrationTest();
