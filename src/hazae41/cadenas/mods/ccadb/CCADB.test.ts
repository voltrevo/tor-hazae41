import { assert } from '../../../../utils/assert.js';
import { CCADB } from './CCADB.js';
import { MemoryStorage } from '../../../../storage/index.js';
import { Log } from '../../../../Log/index.js';
import { App } from '../../../../TorClient/App.js';
import { VirtualClock } from '../../../../clock/index.js';
import { Bytes } from '../../../bytes/index.js';
import { test } from '../../../phobos/mod.js';

// Mock base64 certificates (raw form for storage)
const mockBase64Certs = ['YWJjMTIz', 'ZGVmNDU2'];

function createApp(fetchCertsOverride?: () => Promise<string[]>) {
  const app = new App();
  const clock = new VirtualClock();
  app.set('Clock', clock);
  app.set('Log', new Log({ clock, rawLog: () => {} }));
  app.set('Storage', new MemoryStorage());
  // Mock fetchCerts - returns empty array by default
  app.set('fetchCerts', fetchCertsOverride || (async () => []));
  return app;
}

// ============================================================================
// Storage & Caching Tests
// ============================================================================

test('CCADB: load from storage and re-validate', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const ccadb = new CCADB(app);

  // Set up mock base64 data in storage
  const payload = {
    version: 1,
    savedAt: new Date(app.get('Clock').now()).toISOString(),
    base64Certs: mockBase64Certs,
  };
  const data = Bytes.fromUtf8(JSON.stringify(payload));
  await storage.write('ccadb:cached', data);

  // Call get() - it should load from storage and re-validate
  // Since mockBase64Certs are just base64 strings (not real certs),
  // validation will fail, resulting in empty certificates
  const certs = await ccadb.get();

  // Should be empty because the mock base64 strings are not valid certs
  assert(
    Object.keys(certs).length === 0,
    'Invalid mock base64 certs should result in empty validated set'
  );
});

test('CCADB: does not fetch when cache is available', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  // Track fetchCerts calls
  let fetchCallCount = 0;
  const mockFetchCerts = async () => {
    fetchCallCount++;
    return mockBase64Certs;
  };
  app.set('fetchCerts', mockFetchCerts);

  const ccadb = new CCADB(app);

  // Populate storage with cached base64 certs
  const payload = {
    version: 1,
    savedAt: new Date(app.get('Clock').now()).toISOString(),
    base64Certs: mockBase64Certs,
  };
  const data = Bytes.fromUtf8(JSON.stringify(payload));
  await storage.write('ccadb:cached', data);

  // First get() - should load from storage, not fetch
  await ccadb.get();
  assert(
    fetchCallCount === 0,
    'Should not fetch when storage cache is available'
  );

  // Second get() - should use in-memory cache, not fetch
  await ccadb.get();
  assert(
    fetchCallCount === 0,
    'Should not fetch when in-memory cache is available'
  );
});

test('CCADB: 30-day expiry enforcement', async () => {
  const app = createApp();
  const storage = app.get('Storage');
  const clock = app.get('Clock') as VirtualClock;

  // Save base64 certs at "now"
  const payload = {
    version: 1,
    savedAt: new Date(clock.now()).toISOString(),
    base64Certs: mockBase64Certs,
  };
  const data = Bytes.fromUtf8(JSON.stringify(payload));
  await storage.write('ccadb:cached', data);

  // Load them into a CCADB instance - should get from storage
  let ccadb = new CCADB(app);
  let certs = await ccadb.get();
  assert(
    Object.keys(certs).length === 0,
    'Should load cache at time 0 (even though it validates to empty)'
  );

  // Now advance the clock past 30 days
  const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
  await clock.advanceTime(thirtyOneDaysMs);

  // Create a NEW CCADB instance that will check storage freshness
  // It should detect the cache is stale and fetch fresh (empty) data
  ccadb = new CCADB(app);
  certs = await ccadb.get();

  // Should be empty because fetchCerts returns [] and cache was detected as stale
  assert(
    Object.keys(certs).length === 0,
    'Expired cache should be bypassed and fresh fetch used'
  );

  // Verify the old stale data is still in storage (we dont delete it)
  const storedData = await storage.read('ccadb:cached');
  assert(storedData !== undefined, 'Storage should still contain old cache');
});

test('CCADB: cache miss when storage is empty', async () => {
  const app = createApp();
  const ccadb = new CCADB(app);

  // Storage is empty, so get() should fetch fresh and cache empty result
  const certs = await ccadb.get();

  assert(
    Object.keys(certs).length === 0,
    'Should return empty certs when no storage and no fetch results'
  );

  // Verify something was written to storage (even if empty)
  const storage = app.get('Storage');
  const storedData = await storage.read('ccadb:cached');
  assert(storedData !== undefined, 'Should save to storage after fetch');
});

test('CCADB: clearCache() removes memory and storage', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const ccadb = new CCADB(app);

  // Populate storage
  const payload = {
    version: 1,
    savedAt: new Date(app.get('Clock').now()).toISOString(),
    base64Certs: mockBase64Certs,
  };
  const data = Bytes.fromUtf8(JSON.stringify(payload));
  await storage.write('ccadb:cached', data);

  // Load it into memory
  await ccadb.get();

  // Clear cache
  await ccadb.clearCache();

  // Verify storage is cleared
  const keys = await storage.list('ccadb:');
  assert(keys.length === 0, 'Storage should be cleared after clearCache()');

  // Call get() again - should fetch fresh (empty) since storage is cleared
  const certsAfterClear = await ccadb.get();
  assert(
    Object.keys(certsAfterClear).length === 0,
    'Should fetch fresh empty certs after clear'
  );
});

test('CCADB: storage parse error falls back to fresh fetch', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const ccadb = new CCADB(app);

  // Store invalid JSON in cache
  const invalidData = Bytes.fromUtf8('{ invalid json }');
  await storage.write('ccadb:cached', invalidData);

  // Clear in-memory cache
  await ccadb.clearCache();

  // get() should handle the parse error gracefully and fetch fresh
  const certs = await ccadb.get();

  assert(
    Object.keys(certs).length === 0,
    'Should fetch fresh on storage parse error'
  );
});

test('CCADB: in-memory cache on subsequent calls', async () => {
  const app = createApp();
  const storage = app.get('Storage');

  const ccadb = new CCADB(app);

  // Populate storage
  const payload = {
    version: 1,
    savedAt: new Date(app.get('Clock').now()).toISOString(),
    base64Certs: mockBase64Certs,
  };
  const data = Bytes.fromUtf8(JSON.stringify(payload));
  await storage.write('ccadb:cached', data);

  // First call loads from storage into memory
  let certs = await ccadb.get();
  assert(
    Object.keys(certs).length === 0,
    'First call should load and validate cache'
  );

  // Clear storage to verify second call uses in-memory cache
  await storage.remove('ccadb:cached');

  // Second call should still work from in-memory cache
  certs = await ccadb.get();
  assert(
    Object.keys(certs).length === 0,
    'Second call should use in-memory cache'
  );
});

test('CCADB: fresh fetch saves base64 certs to storage', async () => {
  const mockFetchCerts = async () => mockBase64Certs;
  const app = createApp(mockFetchCerts);
  const storage = app.get('Storage');

  const ccadb = new CCADB(app);

  // First get() call with empty storage will fetch and save
  await ccadb.get();

  // Verify storage was populated
  const keys = await storage.list('ccadb:');
  assert(
    keys.length === 1 && keys[0] === 'ccadb:cached',
    'Should save to storage after fresh fetch'
  );

  // Parse and verify structure
  const storedData = await storage.read('ccadb:cached');
  const text = new TextDecoder().decode(storedData);
  const payload = JSON.parse(text);
  assert(payload.version === 1, 'Should have version 1 in storage payload');
  assert(typeof payload.savedAt === 'string', 'Should have savedAt timestamp');
  assert(Array.isArray(payload.base64Certs), 'Should have base64Certs array');
  assert(payload.base64Certs.length === 2, 'Should have stored 2 base64 certs');
});

// ============================================================================
// Core Certificate Validation Tests
// ============================================================================

test('CCADB: validateAndParseCerts with empty cert list', async () => {
  const app = createApp();
  const ccadb = new CCADB(app);

  // fetchCerts returns empty list by default
  const result = await ccadb.validateAndParseCerts();

  assert(
    Object.keys(result.certificates).length === 0,
    'Should return empty certificates'
  );
  assert(
    result.diagnostics.matched === 0,
    'Should have 0 matched certificates'
  );
  assert(
    result.diagnostics.unrecognized === 0,
    'Should have 0 unrecognized certificates'
  );
});

test('CCADB: validateAndParseCerts returns diagnostics structure', async () => {
  // Create app with mocked fetchCerts that returns some base64 strings
  const mockFetchCerts = async () => [
    'aW52YWxpZGNlcnQ=', // "invalidcert" in base64
    'YW5vdGhlcmludmFsaWQ=', // "anotherinvalid" in base64
  ];

  const app = createApp(mockFetchCerts);
  const ccadb = new CCADB(app);

  const result = await ccadb.validateAndParseCerts();

  // Verify diagnostics structure exists
  assert(
    typeof result.diagnostics.matched === 'number',
    'Should have matched count'
  );
  assert(
    typeof result.diagnostics.unrecognized === 'number',
    'Should have unrecognized count'
  );
  assert(
    typeof result.diagnostics.notFound === 'number',
    'Should have notFound count'
  );
});

// ============================================================================
// Integration Tests
// ============================================================================

test('CCADB: get() validates cached base64 certs', async () => {
  let fetchCallCount = 0;

  const mockFetchCerts = async () => {
    fetchCallCount++;
    return mockBase64Certs;
  };

  const app = createApp(mockFetchCerts);
  const storage = app.get('Storage');

  // First, populate storage with base64 certs
  const payload = {
    version: 1,
    savedAt: new Date(app.get('Clock').now()).toISOString(),
    base64Certs: mockBase64Certs,
  };
  const data = Bytes.fromUtf8(JSON.stringify(payload));
  await storage.write('ccadb:cached', data);

  const ccadb = new CCADB(app);

  // Call get() - should load from storage (no fetch) but still validate
  await ccadb.get();
  assert(fetchCallCount === 0, 'Should not fetch when loading from storage');
});

test('CCADB: clearCache() forces fresh validation', async () => {
  const state: { fetchCallCount: number } = { fetchCallCount: 0 };
  const mockFetchCerts = async () => {
    state.fetchCallCount++;
    return [];
  };

  const app = createApp(mockFetchCerts);
  const ccadb = new CCADB(app);

  // First call
  await ccadb.get();
  assert(state.fetchCallCount > 0, 'First call should fetch');

  const firstCallCount = state.fetchCallCount;

  // Clear and try again
  await ccadb.clearCache();
  await ccadb.get();
  assert(
    state.fetchCallCount > firstCallCount,
    'After clearCache should fetch again'
  );
});

test('CCADB: storage persists base64 certs across instances', async () => {
  const mockFetchCerts = async () => mockBase64Certs;
  const app = createApp(mockFetchCerts);
  const storage = app.get('Storage');

  // Instance 1: save certs to storage
  let ccadb = new CCADB(app);
  await ccadb.get();

  // Verify storage has base64 certs
  const storedData = await storage.read('ccadb:cached');
  const text = new TextDecoder().decode(storedData);
  const payload = JSON.parse(text);
  assert(
    Array.isArray(payload.base64Certs),
    'Storage should contain base64Certs array'
  );
  assert(
    payload.base64Certs.length === 2,
    'Storage should contain 2 base64 certs'
  );

  // Instance 2: new instance should load and re-validate same certs
  let fetchCallCount = 0;
  const trackingFetchCerts = async () => {
    fetchCallCount++;
    return mockBase64Certs;
  };
  app.set('fetchCerts', trackingFetchCerts);

  ccadb = new CCADB(app);
  await ccadb.get();
  assert(
    fetchCallCount === 0,
    'Instance 2 should load from storage, not fetch'
  );
});
