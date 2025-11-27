import { assert } from '@hazae41/phobos';
import { fetchConsensus } from '../TorClient/fetchConsensus';
import { Consensus, Echalote } from '../echalote';
import { readFile, writeFile } from 'fs/promises';
import { decodeKeynetPubKey } from './decodeKeynetPubkey';
import { fetchMicrodescNotAnon } from '../TorClient/fetchMicrodescNotAnon';
import { makeCircuit } from '../TorClient/makeCircuit';

const keynetAddr =
  'https://klefujekdklr4j5v6caad5vkd35folsg4d3dm4oi6ruv67yn3ob7gbid.keynet/';

const microdescHash = 'QMSh+g4F/plxtyLr7W2pepdNkwVpZCwKNz8BBU+RvbY';

async function main() {
  const startTime = Date.now();
  const relTimestamp = () =>
    ((Date.now() - startTime) / 1000).toFixed(1).padStart(5, '0');

  const pubkey = decodeKeynetPubKey(new URL(keynetAddr).host);
  console.log({ pubkey });
  console.log(Buffer.from(pubkey).toString('base64'));

  const circuit = await makeCircuit({
    snowflakeUrl: 'wss://snowflake.pse.dev/',
    onLog: (msg, type) => console.log(`${relTimestamp()} | [${type}] ${msg}`),
  });

  // const consensus = await Echalote.Consensus.fetchOrThrow(circuit);

  const consensus = await Echalote.Consensus.parseOrThrow(
    await readFile('ignore/consensus/2025_11_21T15_25_19_719Z', 'utf-8')
  );

  const head = consensus.microdescs.find(m => m.microdesc === microdescHash);

  if (head === undefined) {
    throw new Error('microdesc hash not found');
  }

  const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
    circuit,
    head
  );

  console.log(microdesc);

  await circuit.extendOrThrow(microdesc);

  console.log('done');
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
