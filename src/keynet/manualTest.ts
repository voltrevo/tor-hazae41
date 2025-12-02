import { Consensus, Echalote } from '../echalote';
import { readFile } from 'fs/promises';
import { decodeKeynetPubKey } from './decodeKeynetPubkey';
import { makeCircuit } from '../TorClient/makeCircuit';
import { fetch } from '../fleche';

// const keynetAddr =
//   'http://hkggnoqjyx3zsdh4y3zau223ulchj4xd3b7xldqihngtacgyag3malyd.keynet/';
const keynetAddr =
  'http://jyn6dehf3ttu4lblc7tr3i23xqsz76dn2du6keptg5kyo3r6mur36vad.keynet';

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

  const circuit = await makeCircuit({
    snowflakeUrl: 'wss://snowflake.pse.dev/',
    onLog: (msg, type) => console.log(`${relTimestamp()} | [${type}] ${msg}`),
  });

  // const consensus = await Echalote.Consensus.fetchOrThrow(circuit);

  const consensus = await Echalote.Consensus.parseOrThrow(
    await readFile('ignore/consensus/2025_12_02T23_04_37_883Z', 'utf-8')
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

  await circuit.extendOrThrow(microdesc);

  const ttcp = await circuit.openOrThrow(new URL(keynetAddr).hostname, 80);

  const response = await fetch(keynetAddr, {
    stream: ttcp.outer,
  });

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
    // keynet servers choose an rsa key such that the first byte of their rsa
    // fingerprint (m.identity) matches the first byte of their ed25519 key
    // (pubkey).
    m => Buffer.from(m.identity, 'base64')[0] === pubkey[0]
  );

  const fullCandidates = await Consensus.Microdesc.fetchManyOrThrow(
    circuit,
    candidates
  );

  for (const candidate of fullCandidates) {
    if (Buffer.from(candidate.idEd25519, 'base64').equals(pubkey)) {
      return candidate;
    }
  }

  throw new Error('Failed to find keynet exit node');
}
