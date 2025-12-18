#!/usr/bin/env npx tsx
/**
 * Integration test for CCADB certificate validation.
 *
 * Uses CCADB to fetch and validate certificates from each source, reporting:
 * - How many certs matched the whitelist
 * - How many unrecognized certs were found (not in whitelist)
 */

import { App } from '../../../../TorClient/App.js';
import { CCADB } from './CCADB.js';
import { fetchCerts, type CertificateSource } from './fetchCerts.js';

async function runIntegrationTest() {
  console.log('=== CCADB Validation Integration Test ===\n');

  try {
    const app = new App();
    app.set('fetchCerts', fetchCerts);

    // Create CCADB instance
    const ccadb = new CCADB(app);

    // Test each source individually
    const sources: CertificateSource[] = ['curl', 'ccadb', 'certifi'];

    for (const source of sources) {
      try {
        console.log(`Testing ${source}...`);
        const result = await ccadb.validateAndParseCerts(source);

        const matched = result.diagnostics.matched;
        const notFound = result.diagnostics.notFound;
        const unrecognized = result.diagnostics.unrecognized;

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

    // Test memoization with the fallback chain
    console.log('=== Testing fallback chain ===\n');
    const result = await ccadb.validateAndParseCerts();
    const matched = result.diagnostics.matched;
    const unrecognized = result.diagnostics.unrecognized;

    console.log(`✅ Successfully fetched ${matched} certificates`);
    if (unrecognized > 0) {
      console.log(`⚠️  Unrecognized: ${unrecognized}`);
    }
  } catch (error) {
    console.log(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

runIntegrationTest();
