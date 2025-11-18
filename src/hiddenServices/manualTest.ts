import { assert } from '@hazae41/phobos';
import { decodeOnionPubKey } from './decodeOnionPubkey';
import { fetchConsensus } from '../TorClient/fetchConsensus';
import { Echalote } from '../echalote';
import { readFile } from 'fs/promises';
import { HiddenServicesDir } from './HiddenServicesDir';
import { getBlindedPubkey } from './getBlindedPubkey';

const onionAddr =
  'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/';

async function main() {
  const startTime = Date.now();
  const relTimestamp = () =>
    ((Date.now() - startTime) / 1000).toFixed(1).padStart(5, '0');

  const pubkey = decodeOnionPubKey(new URL(onionAddr).host);
  console.log({ pubkey });

  // const consensus = await fetchConsensus({
  //   snowflakeUrl: 'wss://snowflake.torproject.net/',
  //   onLog: (msg, type) => console.log(`${relTimestamp()} | [${type}] ${msg}`),
  // });

  const consensus = await Echalote.Consensus.parseOrThrow(
    await readFile('ignore/consensus.txt', 'utf-8')
  );

  const hsdir = new HiddenServicesDir(consensus);

  console.log('interval:', hsdir.interval());

  const blindedPubkey = getBlindedPubkey(
    pubkey,
    hsdir.periodNum(),
    hsdir.periodLength()
  );

  console.log('blinded pubkey:', Buffer.from(blindedPubkey).toString('base64'));
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
