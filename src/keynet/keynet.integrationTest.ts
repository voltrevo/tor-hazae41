import { test } from '@hazae41/phobos';
import { TorClient } from '../TorClient';

test('Keynet connection through TorClient (transparent)', async () => {
  const keynetAddr =
    'http://hkggnoqjyx3zsdh4y3zau223ulchj4xd3b7xldqihngtacgyag3malyd.keynet';

  // TorClient.fetch transparently handles .keynet addresses
  const response = await TorClient.fetch(
    'wss://snowflake.pse.dev/',
    keynetAddr
  );

  const txt = await response.text();
  console.log('Response received:', txt.substring(0, 100));

  console.log('✓ Keynet connection test completed successfully');
});
