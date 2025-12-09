import { decodeHostnamePubKey } from '../hiddenServices/decodeHostnamePubkey.js';
import { Echalote } from '../echalote/index.js';

/**
 * Decodes a .keynet hostname to extract the Ed25519 public key
 *
 * @param host The hostname or URL host part (e.g., "jyn6dehf3ttu4lblc7tr3i23xqsz76dn2du6keptg5kyo3r6mur36vad.keynet")
 * @returns Promise resolving to 32-byte Ed25519 public key
 * @throws Error if not a valid .keynet address
 */
export async function decodeKeynetPubKey(host: string): Promise<Uint8Array> {
  if (!host.endsWith('.keynet')) {
    throw new Error('not a .keynet address');
  }

  const hostname = host.slice(0, -'.keynet'.length);

  return await decodeHostnamePubKey(hostname);
}

/**
 * Finds the keynet exit node (the Tor relay hosting the keynet service)
 * by matching its Ed25519 public key in the consensus.
 *
 * Uses a two-stage filtering approach for efficiency:
 * 1. Coarse filter by RSA fingerprint first byte (keynet servers choose RSA keys with matching first bytes)
 * 2. Fetch full microdescs for candidates
 * 3. Exact match on Ed25519 public key
 *
 * @param circuit The Tor circuit to use for fetching microdescs
 * @param consensus The Tor consensus containing microdesc headers
 * @param pubkey The 32-byte Ed25519 public key we're looking for
 * @returns Promise resolving to the full Microdesc of the keynet exit node
 * @throws Error if keynet exit node is not found in consensus
 */
export async function findKeynetExitNode(
  circuit: Echalote.Circuit,
  consensus: Echalote.Consensus,
  pubkey: Uint8Array
): Promise<Echalote.Consensus.Microdesc> {
  // Coarse filter: match RSA identity first byte with Ed25519 key first byte
  // Keynet servers choose their RSA key specifically to match the first byte
  const candidates = consensus.microdescs.filter(
    m => Buffer.from(m.identity, 'base64')[0] === pubkey[0]
  );

  if (candidates.length === 0) {
    throw new Error(
      'Failed to find keynet exit node: no candidates with matching RSA first byte'
    );
  }

  // Fetch full microdescs for candidates to get Ed25519 identities
  const fullCandidates = await Echalote.Consensus.Microdesc.fetchManyOrThrow(
    circuit,
    candidates
  );

  // Exact match on Ed25519 public key
  for (const candidate of fullCandidates) {
    if (Buffer.from(candidate.idEd25519, 'base64').equals(pubkey)) {
      return candidate;
    }
  }

  throw new Error('Failed to find keynet exit node: no exact Ed25519 match');
}
