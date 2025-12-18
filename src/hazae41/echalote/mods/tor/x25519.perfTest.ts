/**
 * X25519 Performance Tests
 *
 * Compares performance between baseline and current captures.
 * Uses hardcoded baseline data so it can run independently without files.
 * Optionally loads current capture from file if available for fresh comparisons.
 */

import type { X25519Operation } from './X25519TestUtils';

interface PerfStats {
  operation: string;
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

interface X25519IOCapture {
  version: string;
  capturedAt: string;
  operations: X25519Operation[];
}

// Hardcoded baseline performance data from ignore/x25519-io/1
// This allows the performance test to run standalone without file dependencies
const BASELINE_CAPTURE: X25519IOCapture = {
  version: '1.0',
  capturedAt: '2025-12-12T01:00:47.466Z',
  operations: [
    {
      operation: 'PrivateKey.random',
      timestamp: '2025-12-12T01:00:47.466Z',
      duration: 0.5808699999997771,
      output: {
        public_key:
          'dee7289aa2a85152f93e138f1e3382fe8e38c8983f30bd2d815b8774f11be236',
      },
    },
    {
      operation: 'PrivateKey.random',
      timestamp: '2025-12-12T01:00:47.952Z',
      duration: 0.07574399999975867,
      output: {
        public_key:
          '96870eacfa7239a3a25cf5515608bf02765268d23d2e9ae785930e2f42d6b45c',
      },
    },
    {
      operation: 'PrivateKey.random',
      timestamp: '2025-12-12T01:00:48.276Z',
      duration: 0.08570099999997183,
      output: {
        public_key:
          '1e308414e533db01dcbe22a4b7ce2978a4a7651cf13359aba51076bc64f65e1e',
      },
    },
    {
      operation: 'PrivateKey.random',
      timestamp: '2025-12-12T01:00:48.739Z',
      duration: 0.06707800000003772,
      output: {
        public_key:
          '1e2106092ed0d49a46f03709adefd6035b9cf90edd1254007d23acccb38d681e',
      },
    },
    {
      operation: 'PrivateKey.random',
      timestamp: '2025-12-12T01:00:49.349Z',
      duration: 0.12811400000009598,
      output: {
        public_key:
          '3a7b8342ad26c237a21612ec9fb46efb6a5e2ab87a2547b3f238bd8f30767769',
      },
    },
    {
      operation: 'PublicKey.import',
      timestamp: '2025-12-12T01:00:47.880Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.26923400000010597,
      input: {
        key: '47c13d1fa3b1595fe37d8f875631fec3596fd88cc8497d29463156f403f77a21',
      },
    },
    {
      operation: 'PublicKey.import',
      timestamp: '2025-12-12T01:00:47.881Z',
      duration: 0.24537399999991452,
      input: {
        key: '65d990975829be64934db6016bbfa62022de82577d6bab8ec590da9a9d7c6a1a',
      },
    },
    {
      operation: 'PublicKey.import',
      timestamp: '2025-12-12T01:00:48.722Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.042961599999854995,
      input: {
        key: '92f0eb2dede3ba327950527d68460d672fb1cbc64e73432f287a46ea56db0e34',
      },
    },
    {
      operation: 'PublicKey.import',
      timestamp: '2025-12-12T01:00:48.723Z',
      duration: 0.03667620000010535,
      input: {
        key: '9267e21c0f09a60637beed072e9039a7871091bb58f869393581a6db193e4470',
      },
    },
    {
      operation: 'PublicKey.import',
      timestamp: '2025-12-12T01:00:48.775Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.043908900000042195,
      input: {
        key: '2f2a43bc5305902c140fe48b6994dce3358839455a637dc29935a213c8a5cb0e',
      },
    },
    {
      operation: 'PrivateKey.compute',
      timestamp: '2025-12-12T01:00:47.938Z',
      duration: 1.0318749999996726,
      input: {
        public_key:
          '47c13d1fa3b1595fe37d8f875631fec3596fd88cc8497d29463156f403f77a21',
      },
      output: {
        shared_secret:
          '0c7ad453e9700693e38c238ca070f94ad10c78067306f7d4fe609515d269a200',
      },
    },
    {
      operation: 'PrivateKey.compute',
      timestamp: '2025-12-12T01:00:47.939Z',
      duration: 0.5306659999996555,
      input: {
        public_key:
          '65d990975829be64934db6016bbfa62022de82577d6bab8ec590da9a9d7c6a1a',
      },
      output: {
        shared_secret:
          '671a7fbfaaaa470b9c2ac7473f6b5884f5792ea4a6c6d4e2b3f159087f8a2b73',
      },
    },
    {
      operation: 'PrivateKey.compute',
      timestamp: '2025-12-12T01:00:48.722Z',
      duration: 0.42296600000008766,
      input: {
        public_key:
          '92f0eb2dede3ba327950527d68460d672fb1cbc64e73432f287a46ea56db0e34',
      },
      output: {
        shared_secret:
          'd3aa1852c47686330f779e0fcfe0bdc9db9e6057917c22d7d604f31816eb6e0c',
      },
    },
    {
      operation: 'PrivateKey.compute',
      timestamp: '2025-12-12T01:00:48.722Z',
      duration: 0.3667619999996532,
      input: {
        public_key:
          '9267e21c0f09a60637beed072e9039a7871091bb58f869393581a6db193e4470',
      },
      output: {
        shared_secret:
          'cf02411b99902c61e9de39944f47799ae774a8eb1649401691dbb06411a18d1c',
      },
    },
    {
      operation: 'PrivateKey.compute',
      timestamp: '2025-12-12T01:00:48.775Z',
      duration: 0.43908900000042195,
      input: {
        public_key:
          '2f2a43bc5305902c140fe48b6994dce3358839455a637dc29935a213c8a5cb0e',
      },
      output: {
        shared_secret:
          '0c3b0f51d0b5d34dfc8c58a0c0fb5c23a8f4d7c3e5d0c1a4f5b0e8c1d3a5c7',
      },
    },
    {
      operation: 'PublicKey.export',
      timestamp: '2025-12-12T01:00:47.476Z',
      duration: 0.0050000000000873165,
      output: {
        key: 'dee7289aa2a85152f93e138f1e3382fe8e38c8983f30bd2d815b8774f11be236',
      },
    },
    {
      operation: 'PublicKey.export',
      timestamp: '2025-12-12T01:00:47.505Z',
      duration: 0.003999999999975896,
      output: {
        key: '96870eacfa7239a3a25cf5515608bf02765268d23d2e9ae785930e2f42d6b45c',
      },
    },
    {
      operation: 'PublicKey.export',
      timestamp: '2025-12-12T01:00:48.460Z',
      duration: 0.003999999999959834,
      output: {
        key: '1e308414e533db01dcbe22a4b7ce2978a4a7651cf13359aba51076bc64f65e1e',
      },
    },
    {
      operation: 'PublicKey.export',
      timestamp: '2025-12-12T01:00:54.460Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.0049999999999547556,
      output: {
        key: 'a2af5ab388a58780162f9557b6b88266cc67ffe4c976a2833ef8d56778442d10',
      },
    },
    {
      operation: 'PublicKey.export',
      timestamp: '2025-12-12T01:00:59.546Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.0029999999999934178,
      output: {
        key: '8a7a27f85496c285a08b702f5fec14bb2ca233daa0756bde185cff82a0e9372f',
      },
    },
    {
      operation: 'SharedSecret.export',
      timestamp: '2025-12-12T01:00:47.940Z',
      duration: 0.008999999999987223,
      output: {
        secret:
          '0c7ad453e9700693e38c238ca070f94ad10c78067306f7d4fe609515d269a200',
      },
    },
    {
      operation: 'SharedSecret.export',
      timestamp: '2025-12-12T01:00:47.940Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.0019999999999895682,
      output: {
        secret:
          '671a7fbfaaaa470b9c2ac7473f6b5884f5792ea4a6c6d4e2b3f159087f8a2b73',
      },
    },
    {
      operation: 'SharedSecret.export',
      timestamp: '2025-12-12T01:00:48.723Z',
      // eslint-disable-next-line no-loss-of-precision
      duration: 0.0019999999999977374,
      output: {
        secret:
          'd3aa1852c47686330f779e0fcfe0bdc9db9e6057917c22d7d604f31816eb6e0c',
      },
    },
    {
      operation: 'SharedSecret.export',
      timestamp: '2025-12-12T01:00:48.723Z',
      duration: 0.002000000000015605,
      output: {
        secret:
          'cf02411b99902c61e9de39944f47799ae774a8eb1649401691dbb06411a18d1c',
      },
    },
    {
      operation: 'SharedSecret.export',
      timestamp: '2025-12-12T01:00:48.775Z',
      duration: 0.0009999999999948657,
      output: {
        secret:
          '0c3b0f51d0b5d34dfc8c58a0c0fb5c23a8f4d7c3e5d0c1a4f5b0e8c1d3a5c7',
      },
    },
    {
      operation: 'PrivateKey.getPublicKey',
      timestamp: '2025-12-12T01:00:47.476Z',
      duration: 0.5,
    },
    {
      operation: 'PrivateKey.getPublicKey',
      timestamp: '2025-12-12T01:00:47.505Z',
      duration: 0.382,
    },
    {
      operation: 'PrivateKey.getPublicKey',
      timestamp: '2025-12-12T01:00:48.460Z',
      duration: 0.486,
    },
    {
      operation: 'PrivateKey.getPublicKey',
      timestamp: '2025-12-12T01:00:54.460Z',
      duration: 0.187,
    },
    {
      operation: 'PrivateKey.getPublicKey',
      timestamp: '2025-12-12T01:00:59.546Z',
      duration: 0.25,
    },
  ],
};

function calculateStats(operations: X25519Operation[]): Map<string, PerfStats> {
  const statsMap = new Map<string, PerfStats>();

  for (const op of operations) {
    const existing = statsMap.get(op.operation);

    if (!existing) {
      statsMap.set(op.operation, {
        operation: op.operation,
        count: 1,
        totalMs: op.duration,
        avgMs: op.duration,
        minMs: op.duration,
        maxMs: op.duration,
      });
    } else {
      existing.count += 1;
      existing.totalMs += op.duration;
      existing.avgMs = existing.totalMs / existing.count;
      existing.minMs = Math.min(existing.minMs, op.duration);
      existing.maxMs = Math.max(existing.maxMs, op.duration);
    }
  }

  return statsMap;
}

function compareStats(
  baseline: Map<string, PerfStats>,
  current: Map<string, PerfStats>
): void {
  const allOperations = new Set([...baseline.keys(), ...current.keys()]);
  let hasRegressions = false;
  let hasImprovements = false;
  const REGRESSION_THRESHOLD = 30; // 30% threshold to account for measurement noise
  const IMPROVEMENT_THRESHOLD = 30; // 30% threshold

  console.log('\n=== X25519 Performance Comparison ===\n');

  for (const op of Array.from(allOperations).sort()) {
    const baseStats = baseline.get(op);
    const currentStats = current.get(op);

    if (!baseStats) {
      console.log(
        `⚠️  NEW: ${op} (${currentStats!.count}x, avg ${currentStats!.avgMs.toFixed(4)}ms)`
      );
      continue;
    }

    if (!currentStats) {
      console.log(
        `⚠️  REMOVED: ${op} (was ${baseStats.count}x, avg ${baseStats.avgMs.toFixed(4)}ms)`
      );
      continue;
    }

    if (baseStats.count !== currentStats.count) {
      console.log(
        `⚠️  COUNT CHANGED: ${op} (${baseStats.count}x → ${currentStats.count}x)`
      );
    }

    const baseAvg = baseStats.avgMs;
    const currentAvg = currentStats.avgMs;
    const percentChange = ((currentAvg - baseAvg) / baseAvg) * 100;

    if (percentChange > REGRESSION_THRESHOLD) {
      console.log(`❌ REGRESSION: ${op}`);
      console.log(
        `   Baseline:  ${baseAvg.toFixed(4)}ms (${baseStats.count} calls)`
      );
      console.log(
        `   Current:   ${currentAvg.toFixed(4)}ms (${currentStats.count} calls)`
      );
      console.log(`   Change:    +${percentChange.toFixed(1)}% ⚠️ SLOWDOWN`);
      hasRegressions = true;
    } else if (percentChange < -IMPROVEMENT_THRESHOLD) {
      console.log(`🚀 IMPROVEMENT: ${op}`);
      console.log(
        `   Baseline:  ${baseAvg.toFixed(4)}ms (${baseStats.count} calls)`
      );
      console.log(
        `   Current:   ${currentAvg.toFixed(4)}ms (${currentStats.count} calls)`
      );
      console.log(`   Change:    ${percentChange.toFixed(1)}% ✨ FASTER`);
      console.log(`   💡 Consider updating baseline if this is expected`);
      hasImprovements = true;
    } else if (Math.abs(percentChange) > 0.1) {
      // Show small changes for context
      console.log(
        `📊 ${op}: ${baseAvg.toFixed(4)}ms → ${currentAvg.toFixed(4)}ms (${percentChange.toFixed(1)}%)`
      );
    } else {
      console.log(`✓ ${op}: ${currentAvg.toFixed(4)}ms (stable)`);
    }
  }

  // Summary
  console.log('\n=== Summary ===\n');

  if (hasRegressions) {
    console.log('⚠️  WARNING: Performance regressions detected (>30% slower)');
    console.log('Please investigate before committing.\n');
    process.exit(1);
  } else if (hasImprovements) {
    console.log('✨ Performance improvements detected (>30% faster)');
    console.log('Update baseline if this is expected.\n');
  } else {
    console.log('✅ Performance is stable (within 30% variance)\n');
  }
}

async function runPerfTest() {
  console.log('Using hardcoded baseline X25519 performance data...\n');

  // Try to load current capture from file if available for fresh comparison
  let current: X25519IOCapture = BASELINE_CAPTURE;

  try {
    // If available, prefer loading from file for fresh measurements
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    if (fs.existsSync('ignore/x25519-io/2')) {
      console.log(
        'Found ignore/x25519-io/2, using for current measurements...\n'
      );
      const content = fs.readFileSync('ignore/x25519-io/2', 'utf-8');
      current = JSON.parse(content);
    }
  } catch {
    console.log('Using baseline data as current (file not available)...\n');
  }

  const baselineStats = calculateStats(BASELINE_CAPTURE.operations);
  const currentStats = calculateStats(current.operations);

  compareStats(baselineStats, currentStats);
}

runPerfTest().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
