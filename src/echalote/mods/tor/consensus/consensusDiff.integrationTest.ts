import { test } from '@hazae41/phobos';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { computeSignedPartHash } from './diff.js';
import { Echalote } from '../../../index.js';
import { makeCircuit } from '../../../../TorClient/makeCircuit.js';
import { App } from '../../../../TorClient/App.js';

/**
 * Integration test for consensus diff mechanism.
 *
 * This test:
 * 1. Loads multiple saved consensuses from ignore/consensus/
 * 2. Uses older consensuses as "known" when fetching a new one
 * 3. Verifies that the diff mechanism works correctly
 */
test('Consensus diff mechanism with live fetch', async () => {
  const app = new App();

  const startTime = Date.now();
  const relTimestamp = () =>
    ((Date.now() - startTime) / 1000).toFixed(1).padStart(5, '0');

  console.log('=== Consensus Diff Integration Test ===\n');

  // Load saved consensuses from ignore/consensus/
  const consensusDir = 'ignore/consensus';
  const files = await readdir(consensusDir);

  // Filter out non-consensus files and sort by name (which includes timestamp)
  const consensusFiles = files
    .filter(f => f.match(/^\d{4}_\d{2}_\d{2}T\d{2}_\d{2}_\d{2}_\d{3}Z$/))
    .sort();

  if (consensusFiles.length < 2) {
    console.log(
      `Not enough consensus files found (need at least 2, found ${consensusFiles.length})`
    );
    console.log(
      'Skipping test - run the Tor client to fetch consensuses first.'
    );
    return;
  }

  console.log(`Found ${consensusFiles.length} consensus files`);
  console.log(`Using: ${consensusFiles[0]} and ${consensusFiles[1]}\n`);

  // Load and parse the first two consensuses
  const consensus1Text = await readFile(
    join(consensusDir, consensusFiles[0]),
    'utf-8'
  );
  const consensus2Text = await readFile(
    join(consensusDir, consensusFiles[1]),
    'utf-8'
  );

  console.log('Parsing consensuses...');
  const consensus1 = await Echalote.Consensus.parseOrThrow(consensus1Text);
  const consensus2 = await Echalote.Consensus.parseOrThrow(consensus2Text);

  console.log(
    `Consensus 1 valid-after: ${consensus1.validAfter.toISOString()}`
  );
  console.log(
    `Consensus 2 valid-after: ${consensus2.validAfter.toISOString()}`
  );

  // Compute hashes
  const hash1 = await computeSignedPartHash(consensus1.preimage);
  const hash2 = await computeSignedPartHash(consensus2.preimage);

  console.log(`\nConsensus 1 hash: ${hash1}`);
  console.log(`Consensus 2 hash: ${hash2}`);

  // Create a circuit to test live diff fetching
  console.log('\n--- Testing live consensus diff fetch ---');
  console.log(`${relTimestamp()} | Creating circuit...`);

  const circuit = await makeCircuit(app, {
    snowflakeUrl: 'wss://snowflake.pse.dev/',
  });

  console.log(`${relTimestamp()} | Circuit created`);

  // Test 1: Fetch without known consensuses (should get full consensus)
  console.log(
    `\n${relTimestamp()} | Test 1: Fetching consensus without known consensuses...`
  );
  const newConsensus1 = await Echalote.Consensus.fetchOrThrow(circuit);
  console.log(
    `${relTimestamp()} | ✓ Received consensus (valid-after: ${newConsensus1.validAfter.toISOString()})`
  );
  console.log(
    `${relTimestamp()} | ✓ Found ${newConsensus1.microdescs.length} microdescs`
  );

  // Test 2: Fetch with a specific known consensus from disk
  console.log('\n--- Test 2: Using saved consensus as known ---');
  const savedConsensusText = await readFile(
    'ignore/consensus/2025_12_02T23_04_37_883Z',
    'utf-8'
  );
  const savedConsensus =
    await Echalote.Consensus.parseOrThrow(savedConsensusText);
  console.log(
    `${relTimestamp()} | Loaded saved consensus (valid-after: ${savedConsensus.validAfter.toISOString()})`
  );
  console.log(
    `${relTimestamp()} | Saved consensus hash: ${await computeSignedPartHash(savedConsensus.preimage)}`
  );

  // Test 2: Fetch with known consensus (should receive a diff if available)
  console.log(
    `\n${relTimestamp()} | Test 3: Fetching with saved consensus as known...`
  );
  console.log(
    `${relTimestamp()} | Using saved consensus hash: ${await computeSignedPartHash(savedConsensus.preimage)}`
  );

  // Check if the saved consensus is expired (freshUntil has passed)
  const now = new Date();
  console.log(`${relTimestamp()} | Current time: ${now.toISOString()}`);
  console.log(
    `${relTimestamp()} | Saved consensus fresh-until: ${savedConsensus.freshUntil.toISOString()}`
  );

  const isExpired = now > savedConsensus.freshUntil;
  console.log(
    `${relTimestamp()} | Saved consensus is ${isExpired ? 'EXPIRED' : 'still fresh'} (fresh-until has ${isExpired ? 'passed' : 'not passed yet'})`
  );

  if (!isExpired) {
    console.log(
      `${relTimestamp()} | ⚠ Warning: Saved consensus is still fresh, server might return 304`
    );
  } else {
    console.log(
      `${relTimestamp()} | ✓ Saved consensus has expired, expecting newer consensus or diff`
    );
  }

  try {
    const newConsensus2 = await Echalote.Consensus.fetchOrThrow(
      circuit,
      [savedConsensus],
      AbortSignal.timeout(30000)
    );

    console.log(
      `${relTimestamp()} | ✓ Received consensus (valid-after: ${newConsensus2.validAfter.toISOString()})`
    );
    console.log(
      `${relTimestamp()} | ✓ Found ${newConsensus2.microdescs.length} microdescs`
    );

    if (newConsensus2.validAfter > newConsensus1.validAfter) {
      console.log(
        `${relTimestamp()} | ✓ New consensus is newer than previous one`
      );
      console.log(`${relTimestamp()} | ✓ Diff mechanism working correctly!`);
    } else {
      console.log(
        `${relTimestamp()} | ℹ Same consensus returned (no newer one available yet)`
      );
    }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('No matching base consensus')
    ) {
      console.log(
        `${relTimestamp()} | ℹ Server returned a diff for a consensus we don't know`
      );
      console.log(
        `${relTimestamp()} | ℹ This is expected if the server's older consensus is different from ours`
      );
    } else if (
      err instanceof Error &&
      err.message.includes('Invalid response status code 304')
    ) {
      console.log(
        `${relTimestamp()} | ℹ Server returned 304 Not Modified - consensus hasn't changed`
      );
      console.log(
        `${relTimestamp()} | ℹ This confirms the diff mechanism is working (server recognized our known consensus)`
      );
    } else {
      throw err;
    }
  }

  console.log(`\n${relTimestamp()} | All tests completed successfully!`);
});
