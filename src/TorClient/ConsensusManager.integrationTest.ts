import { test } from '@hazae41/phobos';
import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { WebSocketDuplex } from './WebSocketDuplex';
import { createSnowflakeStream } from '../echalote';
import { computeFullConsensusHash } from '../echalote/mods/tor/consensus/diff';
import { ConsensusManager } from './ConsensusManager';
import { Log } from '../Log';
import { SystemClock } from '../clock';
import { App } from './App';
import { MemoryStorage } from '../storage';
import { CertificateManager } from './CertificateManager';
import { staticCerts } from '../cadenas/mods/ccadb/staticCerts';
import { CCADB } from '../cadenas/mods/ccadb/CCADB';
import { CircuitManager } from './CircuitManager';

function createApp() {
  const app = new App();
  app.set('Log', new Log());
  app.set('Clock', new SystemClock());
  app.set('Storage', new MemoryStorage());
  app.set('CertificateManager', new CertificateManager({ app, maxCached: 20 }));
  app.set(
    'CircuitManager',
    new CircuitManager({
      snowflakeUrl: 'wss://snowflake.pse.dev/',
      connectionTimeout: 15_000,
      circuitTimeout: 90_000,
      maxCircuitLifetime: 600_000,
      circuitBuffer: 0,
      app,
    })
  );
  app.set('fetchCerts', () => Promise.resolve(staticCerts));
  app.set('ccadb', new CCADB(app));

  return app;
}

test('ConsensusManager: fetch and reconstruct consensus', async () => {
  const app = createApp();

  // Create a Tor connection
  const snowflakeUrl = 'wss://snowflake.pse.dev/';
  console.log('Connecting to Snowflake bridge...');

  const stream = await WebSocketDuplex.connect(
    snowflakeUrl,
    AbortSignal.timeout(15000)
  );

  const tcp = createSnowflakeStream(stream);
  const tor = new TorClientDuplex(app);

  tcp.outer.readable.pipeTo(tor.inner.writable).catch(error => {
    console.error(`TCP -> Tor stream error: ${error}`);
  });
  tor.inner.readable.pipeTo(tcp.outer.writable).catch(error => {
    console.error(`Tor -> TCP stream error: ${error}`);
  });

  console.log('Waiting for Tor to be ready...');
  await tor.waitOrThrow(AbortSignal.timeout(90000));
  console.log('Tor client ready!');

  // Create a circuit
  console.log('Creating circuit...');
  const circuit: Circuit = await tor.createOrThrow();
  console.log('Circuit created successfully');

  // Fetch a consensus directly
  console.log('Fetching consensus...');
  const consensus = await Echalote.Consensus.fetchOrThrow(circuit);
  console.log(
    `Consensus fetched with ${consensus.microdescs.length} microdescs`
  );

  // Verify fullTextHash was computed
  if (!consensus.fullTextHash) {
    throw new Error('Consensus should have fullTextHash property');
  }
  console.log(`Original fullTextHash: ${consensus.fullTextHash}`);

  // Test reconstruction logic
  console.log('Testing consensus reconstruction...');

  // Verify that signatureText is available (non-optional)
  if (!consensus.signatureText) {
    throw new Error('Consensus.signatureText is not set!');
  }

  console.log(`Preimage length: ${consensus.preimage.length} bytes`);
  console.log(`Signature text length: ${consensus.signatureText.length} bytes`);

  // Reconstruct full text from preimage + signatureText
  const reconstructedText = consensus.preimage + consensus.signatureText;
  console.log(`Reconstructed text length: ${reconstructedText.length} bytes`);

  // Verify the reconstructed text hash matches
  const reconstructedHash = await computeFullConsensusHash(reconstructedText);
  console.log(`Reconstructed fullTextHash: ${reconstructedHash}`);

  // Verify they match
  if (reconstructedHash !== consensus.fullTextHash) {
    throw new Error(
      `Hash mismatch! Original: ${consensus.fullTextHash}, Reconstructed: ${reconstructedHash}`
    );
  }

  console.log('✓ Consensus reconstruction verified successfully!');

  // Also verify we can re-parse the reconstructed text
  console.log('Re-parsing reconstructed consensus...');
  const reparsedConsensus =
    await Echalote.Consensus.parseOrThrow(reconstructedText);
  console.log('✓ Reconstructed text re-parses correctly');

  // Verify key properties match
  if (reparsedConsensus.microdescs.length !== consensus.microdescs.length) {
    throw new Error('Microdesc count mismatch after reconstruction');
  }
  if (
    reparsedConsensus.validAfter.getTime() !== consensus.validAfter.getTime()
  ) {
    throw new Error('validAfter mismatch after reconstruction');
  }
  if (
    reparsedConsensus.freshUntil.getTime() !== consensus.freshUntil.getTime()
  ) {
    throw new Error('freshUntil mismatch after reconstruction');
  }

  console.log('✓ All consensus properties match after reconstruction');

  // Test caching: manually save and load
  console.log('\nTesting consensus caching...');
  const consensusManager = new ConsensusManager({
    app,
    maxCached: 5,
  });

  // Manually save to cache (bypassing getConsensus to avoid diff issues)
  await consensusManager['saveToCache'](consensus);
  console.log('✓ Consensus saved to cache');

  // Load back from cache
  await consensusManager['loadCache']();
  const cache = consensusManager['consensusCache'];
  console.log(`✓ Loaded ${cache.length} consensus(es) from cache`);

  if (cache.length === 0) {
    throw new Error('No consensus loaded from cache');
  }

  const loadedConsensus = cache[0];

  // Verify it has signatureText (non-optional)
  if (!loadedConsensus.signatureText) {
    throw new Error('Loaded consensus is missing signatureText');
  }

  // Verify hash matches by reconstructing
  const loadedFullText =
    loadedConsensus.preimage + loadedConsensus.signatureText;
  const loadedHash = await computeFullConsensusHash(loadedFullText);
  if (loadedHash !== loadedConsensus.fullTextHash) {
    throw new Error(
      `Loaded consensus hash mismatch! Expected: ${loadedConsensus.fullTextHash}, Got: ${loadedHash}`
    );
  }

  console.log('✓ Loaded consensus verified successfully');

  // Clean up
  circuit[Symbol.dispose]();
  tor.close();

  console.log('\nTest completed successfully!');
});
