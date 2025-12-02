import { assert } from '@hazae41/phobos';
import { fetchConsensus } from '../TorClient/fetchConsensus';
import { Consensus, Echalote } from '../echalote';
import { readFile, writeFile } from 'fs/promises';
import { decodeKeynetPubKey } from './decodeKeynetPubkey';
import { fetchMicrodescNotAnon } from '../TorClient/fetchMicrodescNotAnon';
import { makeCircuit } from '../TorClient/makeCircuit';
import { fetch } from '../fleche';

const keynetAddr =
  'http://hkggnoqjyx3zsdh4y3zau223ulchj4xd3b7xldqihngtacgyag3malyd.keynet/';

const microdescHash = 'agHY0v6uEJcM/gg+wK4eSe8t0F/aGKQZQO6gRX/Fu10';

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

async function main() {
  const startTime = Date.now();
  const relTimestamp = () =>
    ((Date.now() - startTime) / 1000).toFixed(1).padStart(5, '0');

  const pubkey = decodeKeynetPubKey(new URL(keynetAddr).host);
  // console.log({ pubkey });
  // console.log(Buffer.from(pubkey).toString('base64'));

  const circuit = await makeCircuit({
    snowflakeUrl: 'wss://snowflake.pse.dev/',
    onLog: (msg, type) => console.log(`${relTimestamp()} | [${type}] ${msg}`),
  });

  // const consensus = await Echalote.Consensus.fetchOrThrow(circuit);

  const consensus = await Echalote.Consensus.parseOrThrow(
    await readFile('ignore/consensus/2025_12_02T04_33_48_292Z', 'utf-8')
  );

  for (let i = 0; i < 1; i++) {
    // FIXME: Only works with exactly one middle?
    const middles = consensus.microdescs.filter(
      it =>
        it.flags.includes('Fast') &&
        it.flags.includes('Stable') &&
        it.flags.includes('V2Dir')
    );

    const middle = middles[Math.floor(Math.random() * middles.length)];
    const middle2 = await Echalote.Consensus.Microdesc.fetchOrThrow(
      circuit,
      middle
    );
    await circuit.extendOrThrow(middle2, AbortSignal.timeout(10000));
  }

  const microdesc = await findKeynetExit(circuit, consensus, pubkey);

  // const head = consensus.microdescs.find(m => m.microdesc === microdescHash);

  // if (head === undefined) {
  //   throw new Error('microdesc hash not found');
  // }

  // console.log(JSON.stringify({ head }, null, 2));

  // const microdesc: Consensus.Microdesc = {
  //   ...head,
  //   onionKey,
  //   ntorOnionKey: 'NS9SoafPkUf5fDk4SybYvwDnDA+rAswrCl5wRea+lXY',
  //   idEd25519: 'OoxmugnF95kM/MbyCmtbosR08uPYf3WOCDtNMAjYAbY',
  // };

  // const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
  //   circuit,
  //   head
  // );

  // console.log(JSON.stringify({ microdesc }, null, 2));

  await circuit.extendOrThrow(microdesc);

  // console.log('circuit extended, fetching another consensus');

  // const consensus2 = await Echalote.Consensus.fetchOrThrow(circuit);

  const ttcp = await circuit.openOrThrow(
    new URL('http://asdf.com/').hostname,
    80
  );

  console.log('opened ttcp');
  // await new Promise(resolve => setTimeout(resolve, 3_000));
  // console.log('waited 3s');

  const fetchOpt = {};

  // const response = await fetch(keynetAddr, {
  //   ...fetchOpt,
  //   stream: ttcp.outer,
  // });

  const response = await fetch('http://asdf.com/', {
    ...fetchOpt,
    stream: ttcp.outer,
  });

  console.log('responded');

  const txt = await response.text();
  console.log(txt);

  console.log('done');
}

async function findKeynetExit(
  circuit: Echalote.Circuit,
  consensus: Consensus,
  pubkey: Uint8Array<ArrayBufferLike>
): Promise<Consensus.Microdesc> {
  const candidates = consensus.microdescs.filter(
    m => Buffer.from(m.identity, 'base64')[0] === pubkey[0]
  );

  console.log(candidates.length, 'candidates');

  for (const candidate of candidates) {
    const microdesc = await Consensus.Microdesc.fetchOrThrow(
      circuit,
      candidate
    );

    if (Buffer.from(microdesc.idEd25519, 'base64').equals(pubkey)) {
      return microdesc;
    }
  }

  throw new Error('Failed to find keynet exit node');
}
