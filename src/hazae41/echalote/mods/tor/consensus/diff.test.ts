import { test, expect } from 'vitest';
import { applyDiffOrThrow, parseDiffOrThrow } from './diff.js';

// Create a simple test consensus
const baseConsensus = `network-status-version 3 microdesc
vote-status consensus
consensus-method 33
valid-after 2025-12-01 00:00:00
fresh-until 2025-12-01 01:00:00
known-flags Authority Exit Fast Guard
params test=1
directory-signature `;

test('Consensus diff: parsing diff format', async () => {
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

  const diff = parseDiffOrThrow(testDiff);

  expect(diff.version === 1).toBe(true);
  expect(diff.fromHash === 'abcd1234').toBe(true);
  expect(diff.toHash === 'efgh5678').toBe(true);
  expect(diff.commands.length === 2).toBe(true);
});

test('Consensus diff: applying diff', async () => {
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

  const diff = parseDiffOrThrow(testDiff);
  const result = applyDiffOrThrow(baseConsensus, diff);
  const lines = result.split('\n');

  // Check that old lines are removed
  expect(
    lines.includes('vote-status consensus'),
    'Old line "vote-status consensus" should have been replaced'
  ).toBe(false);
  expect(
    lines.includes('consensus-method 33'),
    'Old line "consensus-method 33" should have been replaced'
  ).toBe(false);
  expect(
    lines.includes('valid-after 2025-12-01 00:00:00'),
    'Old line "valid-after 2025-12-01 00:00:00" should have been replaced'
  ).toBe(false);
  expect(
    lines.includes('params test=1'),
    'Old line "params test=1" should have been replaced'
  ).toBe(false);

  // Check that new lines are present
  expect(
    lines.includes('vote-status updated'),
    'New line "vote-status updated" should be present'
  ).toBe(true);
  expect(
    lines.includes('consensus-method 34'),
    'New line "consensus-method 34" should be present'
  ).toBe(true);
  expect(
    lines.includes('params test=2 new=3'),
    'New line "params test=2 new=3" should be present'
  ).toBe(true);
});

test('Consensus diff: delete command', async () => {
  const deleteDiff = `network-status-diff-version 1
hash test1 test2
3,4d`;

  const deleteResult = applyDiffOrThrow(
    baseConsensus,
    parseDiffOrThrow(deleteDiff)
  );

  const deleteLines = deleteResult.split('\n');

  expect(!deleteLines.includes('consensus-method 33')).toBe(true);
  expect(!deleteLines.includes('valid-after 2025-12-01 00:00:00')).toBe(true);
});

test('Consensus diff: append command', async () => {
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

  expect(appendLines.includes('new-field added-value')).toBe(true);
  expect(appendLines.includes('another-field another-value')).toBe(true);
});
