import { test } from '../hazae41/phobos/mod';
import { readFile } from 'fs/promises';
import { Echalote } from '../echalote/index.js';
import { decodeOnionPubKey } from './decodeOnionPubkey.js';
import { HiddenServicesDir } from './HiddenServicesDir.js';
import { getBlindedPubkey } from './getBlindedPubkey.js';
import { Log } from '../Log/index.js';

test('Hidden services directory lookup', async () => {
  const log = new Log();

  const onionAddr =
    'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/';

  const startTime = Date.now();
  const relTimestamp = () =>
    ((Date.now() - startTime) / 1000).toFixed(1).padStart(5, '0');

  const pubkey = await decodeOnionPubKey(new URL(onionAddr).host);
  console.log(`${relTimestamp()} | Pubkey:`, pubkey);

  const consensus = await Echalote.Consensus.parseOrThrow(
    log.child('Consensus'),
    await readFile('ignore/consensus.txt', 'utf-8')
  );

  const hsdir = new HiddenServicesDir(consensus);

  const interval = hsdir.interval();
  console.log(`${relTimestamp()} | Interval:`, interval);

  const blindedPubkey = await getBlindedPubkey(
    pubkey,
    hsdir.periodNum(),
    hsdir.periodLength()
  );

  console.log(
    `${relTimestamp()} | Blinded pubkey:`,
    btoa(String.fromCharCode(...blindedPubkey))
  );

  console.log('✓ Hidden services directory test completed successfully');
});
