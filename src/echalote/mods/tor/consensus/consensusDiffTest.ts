import { parseDiffOrThrow, applyDiffOrThrow } from './diff.js';

/**
 * Simple test for consensus diff parsing and application.
 * This test doesn't require network access.
 */

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

async function main() {
  console.log('=== Consensus Diff Parser Test ===\n');

  // Create a simple test consensus
  const baseConsensus = `network-status-version 3 microdesc
vote-status consensus
consensus-method 33
valid-after 2025-12-01 00:00:00
fresh-until 2025-12-01 01:00:00
known-flags Authority Exit Fast Guard
params test=1
directory-signature `;

  // Create a test diff
  // Replace lines 2-4 (vote-status through valid-after)
  // Replace line 7 (params)
  const testDiff = `network-status-diff-version 1
hash abcd1234 efgh5678
7c
params test=2 new=3
.
2,4c
vote-status updated
consensus-method 34
valid-after 2025-12-01 01:00:00
.`;

  console.log('Test 1: Parsing diff format');
  const diff = parseDiffOrThrow(testDiff);

  console.log(`  Version: ${diff.version}`);
  console.log(`  From hash: ${diff.fromHash}`);
  console.log(`  To hash: ${diff.toHash}`);
  console.log(`  Commands: ${diff.commands.length}`);

  if (diff.version !== 1) throw new Error('Invalid version');
  if (diff.fromHash !== 'abcd1234') throw new Error('Invalid fromHash');
  if (diff.toHash !== 'efgh5678') throw new Error('Invalid toHash');
  if (diff.commands.length !== 2) throw new Error('Invalid command count');

  console.log('  ✓ Diff parsed correctly\n');

  console.log('Test 2: Applying diff');
  const result = applyDiffOrThrow(baseConsensus, diff);

  console.log('  Result:');
  console.log(
    result
      .split('\n')
      .map(l => `    ${l}`)
      .join('\n')
  );
  console.log();

  const lines = result.split('\n');

  // Check that old lines are removed
  if (lines.includes('vote-status consensus')) {
    throw new Error(
      'Old line "vote-status consensus" should have been replaced'
    );
  }
  if (lines.includes('consensus-method 33')) {
    throw new Error('Old line "consensus-method 33" should have been replaced');
  }
  if (lines.includes('valid-after 2025-12-01 00:00:00')) {
    throw new Error(
      'Old line "valid-after 2025-12-01 00:00:00" should have been replaced'
    );
  }
  if (lines.includes('params test=1')) {
    throw new Error('Old line "params test=1" should have been replaced');
  }

  // Check that new lines are present
  if (!lines.includes('vote-status updated')) {
    throw new Error('New line "vote-status updated" not found');
  }
  if (!lines.includes('consensus-method 34')) {
    throw new Error('New line "consensus-method 34" not found');
  }
  if (!lines.includes('params test=2 new=3')) {
    throw new Error('New line "params test=2 new=3" not found');
  }

  console.log('  ✓ Diff applied correctly\n');

  console.log('Test 3: Delete command');
  const deleteDiff = `network-status-diff-version 1
hash test1 test2
3,4d`;

  const deleteResult = applyDiffOrThrow(
    baseConsensus,
    parseDiffOrThrow(deleteDiff)
  );

  const deleteLines = deleteResult.split('\n');
  if (deleteLines.includes('consensus-method 33')) {
    throw new Error('Delete command failed');
  }
  if (deleteLines.includes('valid-after 2025-12-01 00:00:00')) {
    throw new Error('Delete command failed');
  }

  console.log('  ✓ Delete command works\n');

  console.log('Test 4: Append command');
  const appendDiff = `network-status-diff-version 1
hash test1 test2
3a
new-field added-value
another-field another-value
.`;

  const appendResult = applyDiffOrThrow(
    baseConsensus,
    parseDiffOrThrow(appendDiff)
  );

  const appendLines = appendResult.split('\n');
  if (!appendLines.includes('new-field added-value')) {
    throw new Error('Append command failed');
  }
  if (!appendLines.includes('another-field another-value')) {
    throw new Error('Append command failed');
  }

  console.log('  ✓ Append command works\n');

  console.log('All tests passed! ✓');
}
