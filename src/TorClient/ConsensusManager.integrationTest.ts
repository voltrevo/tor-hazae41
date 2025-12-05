import { test } from '@hazae41/phobos';
import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { initWasm } from './initWasm';
import { WebSocketDuplex } from './WebSocketDuplex';
import { createSnowflakeStream } from '../echalote';
import { computeFullConsensusHash } from '../echalote/mods/tor/consensus/diff';
import { ConsensusManager } from './ConsensusManager';
import { createFsStorage } from '../storage/fs';
import { Log } from '../Log';

test('ConsensusManager: fetch and reconstruct consensus', async () => {
  // Initialize WASM
  await initWasm();

  // Create storage for caching
  const storage = createFsStorage('/tmp/tor-consensus-test-cache');

  // Create a Tor connection
  const snowflakeUrl = 'wss://snowflake.pse.dev/';
  console.log('Connecting to Snowflake bridge...');

  const stream = await WebSocketDuplex.connect(
    snowflakeUrl,
    AbortSignal.timeout(15000)
  );

  const tcp = createSnowflakeStream(stream);
  const tor = new TorClientDuplex();

  tcp.outer.readable.pipeTo(tor.inner.writable).catch(() => {});
  tor.inner.readable.pipeTo(tcp.outer.writable).catch(() => {});

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
  const log = new Log();
  const consensusManager = new ConsensusManager({ storage, log });

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
