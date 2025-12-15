import { test } from '@hazae41/phobos';
import { TorClient } from '../TorClient/versions/standard';

test('Keynet connection through TorClient (transparent)', async () => {
  const keynetAddr =
    'http://jyn6dehf3ttu4lblc7tr3i23xqsz76dn2du6keptg5kyo3r6mur36vad.keynet/';

  // TorClient.fetch transparently handles .keynet addresses
  const response = await TorClient.fetch(
    'wss://snowflake.pse.dev/',
    keynetAddr
  );

  const txt = await response.text();
  console.log('Response received:', txt.substring(0, 100));

  console.log('✓ Keynet connection test completed successfully');
});
