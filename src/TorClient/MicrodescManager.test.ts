import { Buffer } from 'buffer';
import { test } from '@hazae41/phobos';
import { assert } from '../utils/assert';
import { MicrodescManager } from './MicrodescManager';
import { MemoryStorage } from '../storage';
import { Log } from '../Log';
import { Echalote } from '../echalote';
import { App } from './App';
import { VirtualClock } from '../clock';

// Mock microdesc factory
function createMockMicrodesc(
  overrides: Partial<Echalote.Consensus.Microdesc> = {}
): Echalote.Consensus.Microdesc {
  return {
    nickname: overrides.nickname || 'test-relay',
    identity:
      overrides.identity || Buffer.from('test-identity').toString('base64'),
    date: overrides.date || '2024-01-01',
    hour: overrides.hour || '12:00:00',
    hostname: overrides.hostname || 'test.example.com',
    orport: overrides.orport || 9001,
    dirport: overrides.dirport || 9030,
    ipv6: overrides.ipv6,
    microdesc:
      overrides.microdesc ||
      'test-hash-' + Math.random().toString(36).substring(2, 11),
    flags: overrides.flags || ['Fast', 'Running'],
    version: overrides.version || '0.4.7.0',
    entries: overrides.entries || {},
    bandwidth: overrides.bandwidth || { average: '1000' },
    onionKey: overrides.onionKey || 'test-onion-key',
    ntorOnionKey: overrides.ntorOnionKey || 'test-ntor-key',
    idEd25519: overrides.idEd25519 || 'test-ed25519-key',
    ...overrides,
  } as Echalote.Consensus.Microdesc;
}

function createApp() {
  const app = new App();
  const clock = new VirtualClock();
  app.set('Clock', clock);
  app.set('Log', new Log({ clock, rawLog: () => {} }));
  app.set('Storage', new MemoryStorage());

  return app;
}

test('MicrodescManager: saveToCache and retrieval', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const microdescManager = new MicrodescManager({
    app,
    maxCached: 10,
  });

  try {
    const mockMicrodesc = createMockMicrodesc({
      microdesc: 'test-hash-save',
      identity: 'test-id-save',
    });

    // Save a microdesc to cache
    await microdescManager.saveToCache(mockMicrodesc);

    // Verify it's in storage
    const cachedData = await storage.read('microdesc:test-hash-save');
    assert(cachedData !== undefined, 'Microdesc should be cached in storage');

    // Verify we can parse it back
    const text = new TextDecoder().decode(cachedData);
    const parsed = JSON.parse(text);
    assert(
      parsed.microdesc === 'test-hash-save',
      'Should deserialize correctly'
    );
  } finally {
    microdescManager.close();
  }
});

test('MicrodescManager: cache size limit enforcement', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const microdescManager = new MicrodescManager({
    app,
    maxCached: 2, // Small cache for testing
  });

  try {
    // Manually add 3 microdescs to cache (exceeding limit of 2)
    const md1 = createMockMicrodesc({ microdesc: 'hash-limit-1' });
    const md2 = createMockMicrodesc({ microdesc: 'hash-limit-2' });
    const md3 = createMockMicrodesc({ microdesc: 'hash-limit-3' });

    await microdescManager.saveToCache(md1);
    await microdescManager.saveToCache(md2);
    await microdescManager.saveToCache(md3);

    // Only the most recent 2 should remain (FIFO eviction)
    const remaining = await storage.list('microdesc:');
    assert(
      remaining.length <= 2,
      `Cache size should be limited to maxCached (2), but found ${remaining.length}`
    );
  } finally {
    microdescManager.close();
  }
});

test('MicrodescManager: multiple microdescs in cache', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const microdescManager = new MicrodescManager({
    app,
    maxCached: 100,
  });

  try {
    // Add multiple microdescs
    const microdescs = [];
    for (let i = 0; i < 5; i++) {
      const md = createMockMicrodesc({
        microdesc: `hash-${i}`,
        identity: `id-${i}`,
      });
      microdescs.push(md);
      await microdescManager.saveToCache(md);
    }

    // Verify all are in storage
    const remaining = await storage.list('microdesc:');
    assert(remaining.length === 5, 'All 5 microdescs should be cached');

    // Verify we can read them back
    for (let i = 0; i < 5; i++) {
      const cachedData = await storage.read(`microdesc:hash-${i}`);
      assert(cachedData !== undefined, `Microdesc hash-${i} should be cached`);
    }
  } finally {
    microdescManager.close();
  }
});
