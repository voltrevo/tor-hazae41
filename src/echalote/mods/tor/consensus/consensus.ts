import { ASN1 } from '@hazae41/asn1';
import { Base16 } from '@hazae41/base16';
import { Base64 } from '@hazae41/base64';
import { Bytes } from '@hazae41/bytes';
import { fetch } from '../../../../fleche';
import { RsaWasm } from '@hazae41/rsa.wasm';
import { OIDs, X509 } from '@hazae41/x509';
import { Mutable } from '../../../libs/typescript/typescript';
import { assert } from '../../../../utils/assert.js';
import { Circuit } from '../circuit.js';
import pLimit from 'p-limit';
import {
  computeSignedPartHash,
  computeFullConsensusHash,
  parseDiffOrThrow,
  applyDiffOrThrow,
} from './diff.js';

export interface Consensus {
  readonly type: string;
  readonly version: number;
  readonly status: string;
  readonly method: number;
  readonly validAfter: Date;
  readonly freshUntil: Date;
  readonly validUntil: Date;
  readonly votingDelay: [number, number];
  readonly clientVersions: string[];
  readonly serverVersions: string[];
  readonly knownFlags: string[];
  readonly recommendedClientProtocols: Record<string, string>;
  readonly recommendedRelayProtocols: Record<string, string>;
  readonly requiredClientProtocols: Record<string, string>;
  readonly requiredRelayProtocols: Record<string, string>;
  readonly params: Record<string, string>;
  readonly sharedRandPreviousValue: Consensus.SharedRandom;
  readonly sharedRandCurrentValue: Consensus.SharedRandom;
  readonly authorities: Consensus.Authority[];
  readonly microdescs: Consensus.Microdesc.Head[];
  readonly bandwidthWeights: Record<string, string>;

  readonly preimage: string;
  readonly signatures: Consensus.Signature[];
  readonly fullTextHash: string;
  readonly signatureText: string;
}

export namespace Consensus {
  export interface SharedRandom {
    readonly reveals: number;
    readonly random: string;
  }

  export interface Authority {
    readonly nickname: string;
    readonly identity: string;
    readonly hostname: string;
    readonly ipaddress: string;
    readonly dirport: number;
    readonly orport: number;
    readonly contact: string;
    readonly digest: string;
  }

  export namespace Authority {
    export const trusteds = new Set([
      '0232AF901C31A04EE9848595AF9BB7620D4C5B2E',
      '14C131DFC5C6F93646BE72FA1401C02A8DF2E8B4',
      '23D15D965BC35114467363C165C4F724B64B4F66',
      '27102BC123E7AF1D4741AE047E160C91ADC76B21',
      '49015F787433103580E3B66A1707A00E60F2D15B',
      'E8A9C45EDE6D711294FADF8E7951F4DE6CA56B58',
      'ED03BB616EB2F60BEC80151114BB25CEF515B226',
      'F533C81CEF0BC0267857C99B2F471ADF249FA232',
    ]);
  }

  export interface Signature {
    readonly algorithm: string;
    readonly identity: string;
    readonly signingKeyDigest: string;
    readonly signature: string;
  }

  /**
   * Fetches a consensus from a directory server.
   *
   * @param circuit - The circuit to use for fetching
   * @param known - Array of known consensuses. If provided, will attempt to fetch
   *                a diff instead of the full consensus. The server may return a diff
   *                from one of the known consensuses to save bandwidth.
   * @param signal - AbortSignal for cancellation
   * @returns The fetched and verified consensus
   *
   * @example
   * // Fetch without diff support
   * const consensus1 = await Consensus.fetchOrThrow(circuit);
   *
   * // Later, fetch with diff support
   * const consensus2 = await Consensus.fetchOrThrow(circuit, [consensus1]);
   */
  export async function fetchOrThrow(
    circuit: Circuit,
    known: Consensus[] = [],
    signal = new AbortController().signal,
    certificateManager?: {
      getCertificates: (
        circuit: Circuit,
        fingerprints: string[]
      ) => Promise<Certificate[]>;
    }
  ) {
    const stream = await circuit.openDirOrThrow({}, signal);

    // Compute SHA3-256 hashes of known consensuses for diff request
    const knownHashes = await Promise.all(
      known.map(c => computeSignedPartHash(c.preimage))
    );
    const headers: Record<string, string> = {};

    if (knownHashes.length > 0) {
      // Send X-Or-Diff-From-Consensus header with hex-encoded hashes
      headers['X-Or-Diff-From-Consensus'] = knownHashes.join(', ');
      console.log(
        `[CONSENSUS DIFF] Requesting diff from ${knownHashes.length} known consensus(es): ${knownHashes.join(', ')}`
      );
    }

    const requestTime = new Date();

    const response = await fetch(
      `http://localhost/tor/status-vote/current/consensus-microdesc.z`,
      { stream: stream.outer, signal, headers }
    );

    // Handle 304 Not Modified - the known consensus is still current
    if (response.status === 304) {
      console.warn(
        'Received 304 Not Modified - the known consensus is still current'
      );
      assert(
        known.length > 0,
        'Received 304 but no known consensus was provided'
      );
      // Return the most recent known consensus based on validAfter date (already verified)
      const mostRecent = known.reduce((latest, current) =>
        current.validAfter > latest.validAfter ? current : latest
      );

      // Check if the most recent consensus has expired
      assert(
        requestTime <= mostRecent.validUntil,
        `Most recent known consensus has expired (validUntil: ${mostRecent.validUntil.toISOString()}, requestTime: ${requestTime.toISOString()})`
      );

      return mostRecent;
    }

    const contentType = response.headers.get('Content-Type') || '';
    const consensusTxt = await response.text();

    let consensus: Consensus;

    // Check if we received a diff
    if (
      contentType.includes('diff') ||
      consensusTxt.startsWith('network-status-diff-version')
    ) {
      // Parse and apply the diff
      const diff = parseDiffOrThrow(consensusTxt);

      console.log(
        `[CONSENSUS DIFF] Received diff with ${diff.commands.length} commands`
      );

      let baseConsensus: Consensus | undefined = undefined;

      // Find the matching known consensus
      for (const c of known) {
        if (
          (await computeSignedPartHash(c.preimage)).toLowerCase() ===
          diff.fromHash.toLowerCase()
        ) {
          baseConsensus = c;
          break;
        }
      }

      assert(
        baseConsensus,
        `No matching base consensus found for diff (hash: ${diff.fromHash})`
      );

      console.log(
        `[CONSENSUS DIFF] Applying diff from ${diff.fromHash.substring(0, 8)}... to ${diff.toHash.substring(0, 8)}...`
      );

      // Apply the diff to reconstruct the full consensus text
      const fullConsensusTxt = applyDiffOrThrow(baseConsensus.preimage, diff);

      // Verify the result hash matches
      const resultHash = await computeFullConsensusHash(fullConsensusTxt);

      assert(
        resultHash.toLowerCase() === diff.toHash.toLowerCase(),
        `Diff result hash mismatch: expected ${diff.toHash}, got ${resultHash}`
      );

      console.log(
        `[CONSENSUS DIFF] ✓ Successfully applied diff (${fullConsensusTxt.length} bytes)`
      );

      consensus = await Consensus.parseOrThrow(fullConsensusTxt);
    } else {
      // Regular full consensus
      consensus = await Consensus.parseOrThrow(consensusTxt);
    }

    assert(
      (await Consensus.verifyOrThrow(
        circuit,
        consensus,
        signal,
        certificateManager
      )) === true,
      `Could not verify`
    );

    // Check if the fetched consensus has already expired
    assert(
      requestTime <= consensus.validUntil,
      `Fetched consensus has already expired (validUntil: ${consensus.validUntil.toISOString()}, requestTime: ${requestTime.toISOString()})`
    );

    return consensus;
  }

  export async function parseOrThrow(text: string) {
    const lines = text.split('\n');

    const consensus: Partial<Mutable<Consensus>> = {};

    const authorities: Authority[] = [];
    const microdescs: Microdesc.Head[] = [];
    const signatures: Signature[] = [];
    const invalidMicrodescs: {
      index: number;
      reason: string;
      data?: string;
    }[] = [];

    for (const i = { x: 0 }; i.x < lines.length; i.x++) {
      if (lines[i.x].startsWith('network-status-version ')) {
        const [, version, type] = lines[i.x].split(' ');
        consensus.version = Number(version);
        consensus.type = type;
        continue;
      }

      if (lines[i.x].startsWith('vote-status ')) {
        const [, status] = lines[i.x].split(' ');
        consensus.status = status;
        continue;
      }

      if (lines[i.x].startsWith('consensus-method ')) {
        const [, method] = lines[i.x].split(' ');
        consensus.method = Number(method);
        continue;
      }

      if (lines[i.x].startsWith('valid-after ')) {
        const validAfter = lines[i.x].split(' ').slice(1).join(' ');
        consensus.validAfter = new Date(validAfter + ' UTC');
        continue;
      }

      if (lines[i.x].startsWith('fresh-until ')) {
        const freshUntil = lines[i.x].split(' ').slice(1).join(' ');
        consensus.freshUntil = new Date(freshUntil + ' UTC');
        continue;
      }

      if (lines[i.x].startsWith('valid-until ')) {
        const validUntil = lines[i.x].split(' ').slice(1).join(' ');
        consensus.validUntil = new Date(validUntil + ' UTC');
        continue;
      }

      if (lines[i.x].startsWith('voting-delay ')) {
        const [, first, second] = lines[i.x].split(' ');
        consensus.votingDelay = [Number(first), Number(second)];
        continue;
      }

      if (lines[i.x].startsWith('client-versions ')) {
        const [, versions] = lines[i.x].split(' ');
        consensus.clientVersions = versions.split(',');
        continue;
      }

      if (lines[i.x].startsWith('server-versions ')) {
        const [, versions] = lines[i.x].split(' ');
        consensus.serverVersions = versions.split(',');
        continue;
      }

      if (lines[i.x].startsWith('known-flags ')) {
        const [, ...flags] = lines[i.x].split(' ');
        consensus.knownFlags = flags;
        continue;
      }

      if (lines[i.x].startsWith('recommended-client-protocols ')) {
        const [, ...protocols] = lines[i.x].split(' ');
        consensus.recommendedClientProtocols = Object.fromEntries(
          protocols.map(entry => entry.split('='))
        );
        continue;
      }

      if (lines[i.x].startsWith('recommended-relay-protocols ')) {
        const [, ...protocols] = lines[i.x].split(' ');
        consensus.recommendedRelayProtocols = Object.fromEntries(
          protocols.map(entry => entry.split('='))
        );
        continue;
      }

      if (lines[i.x].startsWith('required-client-protocols ')) {
        const [, ...protocols] = lines[i.x].split(' ');
        consensus.requiredClientProtocols = Object.fromEntries(
          protocols.map(entry => entry.split('='))
        );
        continue;
      }

      if (lines[i.x].startsWith('required-relay-protocols ')) {
        const [, ...protocols] = lines[i.x].split(' ');
        consensus.requiredRelayProtocols = Object.fromEntries(
          protocols.map(entry => entry.split('='))
        );
        continue;
      }

      if (lines[i.x].startsWith('params ')) {
        const [, ...params] = lines[i.x].split(' ');
        consensus.params = Object.fromEntries(
          params.map(entry => entry.split('='))
        );
        continue;
      }

      if (lines[i.x].startsWith('shared-rand-previous-value ')) {
        const [, reveals, random] = lines[i.x].split(' ');
        consensus.sharedRandPreviousValue = {
          reveals: Number(reveals),
          random,
        };
        continue;
      }

      if (lines[i.x].startsWith('shared-rand-current-value ')) {
        const [, reveals, random] = lines[i.x].split(' ');
        consensus.sharedRandCurrentValue = { reveals: Number(reveals), random };
        continue;
      }

      if (lines[i.x] === 'directory-footer') {
        for (i.x++; i.x < lines.length; i.x++) {
          if (lines[i.x].startsWith('bandwidth-weights ')) {
            const [, ...weights] = lines[i.x].split(' ');
            consensus.bandwidthWeights = Object.fromEntries(
              weights.map(entry => entry.split('='))
            );
            continue;
          }

          if (lines[i.x].startsWith('directory-signature ')) {
            consensus.preimage ??= `${lines.slice(0, i.x).join('\n')}\ndirectory-signature `;

            const item: Partial<Mutable<Consensus.Signature>> = {};
            const [, algorithm, identity, signingKeyDigest] =
              lines[i.x].split(' ');
            item.algorithm = algorithm;
            item.identity = identity;
            item.signingKeyDigest = signingKeyDigest;

            i.x++;

            item.signature = readSignatureOrThrow(lines, i);

            assert(item.algorithm != null, 'Missing algorithm');
            assert(item.identity != null, 'Missing identity');
            assert(item.signingKeyDigest != null, 'Missing signingKeyDigest');
            assert(item.signature != null, 'Missing signature');

            const signature = item as Consensus.Signature;
            signatures.push(signature);
            continue;
          }

          continue;
        }

        break;
      }

      if (lines[i.x].startsWith('dir-source ')) {
        const item: Partial<Mutable<Authority>> = {};
        const [_, nickname, identity, hostname, ipaddress, dirport, orport] =
          lines[i.x].split(' ');
        item.nickname = nickname;
        item.identity = identity;
        item.hostname = hostname;
        item.ipaddress = ipaddress;
        item.dirport = Number(dirport);
        item.orport = Number(orport);

        for (i.x++; i.x < lines.length; i.x++) {
          if (lines[i.x].startsWith('dir-source ')) {
            i.x--;
            break;
          }

          if (lines[i.x].startsWith('r ')) {
            i.x--;
            break;
          }

          if (lines[i.x] === 'directory-footer') {
            i.x--;
            break;
          }

          if (lines[i.x].startsWith('contact ')) {
            const contact = lines[i.x].split(' ').slice(1).join(' ');
            item.contact = contact;
            continue;
          }

          if (lines[i.x].startsWith('vote-digest ')) {
            const [_, digest] = lines[i.x].split(' ');
            item.digest = digest;
            continue;
          }

          continue;
        }

        assert(item.nickname != null, 'Missing nickname');
        assert(item.identity != null, 'Missing identity');
        assert(item.hostname != null, 'Missing hostname');
        assert(item.ipaddress != null, 'Missing ipaddress');
        assert(item.dirport != null, 'Missing dirport');
        assert(item.orport != null, 'Missing orport');
        assert(item.contact != null, 'Missing contact');
        assert(item.digest != null, 'Missing digest');

        const authority = item as Authority;
        authorities.push(authority);
        continue;
      }

      if (lines[i.x].startsWith('r ')) {
        const item: Partial<Mutable<Microdesc.Head>> = {};
        const microdescIndex = microdescs.length + invalidMicrodescs.length;

        // Validate that the r line has exactly 8 fields
        const rParts = lines[i.x].split(' ');
        if (rParts.length !== 8) {
          // Track malformed r lines
          invalidMicrodescs.push({
            index: microdescIndex,
            reason: `malformed r line: expected 8 fields, got ${rParts.length}`,
            data:
              lines[i.x].length > 100
                ? lines[i.x].substring(0, 100) + '...'
                : lines[i.x],
          });
          continue;
        }

        const [_, nickname, identity, date, hour, hostname, orport, dirport] =
          rParts;
        item.nickname = nickname;
        item.identity = identity;
        item.date = date;
        item.hour = hour;
        item.hostname = hostname;
        item.orport = Number(orport);
        item.dirport = Number(dirport);

        for (i.x++; i.x < lines.length; i.x++) {
          if (lines[i.x].startsWith('dir-source ')) {
            i.x--;
            break;
          }

          if (lines[i.x].startsWith('r ')) {
            i.x--;
            break;
          }

          if (lines[i.x] === 'directory-footer') {
            i.x--;
            break;
          }

          if (lines[i.x].startsWith('a ')) {
            const [, ipv6] = lines[i.x].split(' ');
            item.ipv6 = ipv6;
            continue;
          }

          if (lines[i.x].startsWith('m ')) {
            const [, digest] = lines[i.x].split(' ');
            item.microdesc = digest;
            continue;
          }

          if (lines[i.x].startsWith('s ')) {
            const [, ...flags] = lines[i.x].split(' ');
            item.flags = flags;
            continue;
          }

          if (lines[i.x].startsWith('v ')) {
            const version = lines[i.x].slice('v '.length);
            item.version = version;
            continue;
          }

          if (lines[i.x].startsWith('pr ')) {
            const [, ...entries] = lines[i.x].split(' ');
            item.entries = Object.fromEntries(
              entries.map(entry => entry.split('='))
            );
            continue;
          }

          if (lines[i.x].startsWith('w ')) {
            const [, ...entries] = lines[i.x].split(' ');
            item.bandwidth = Object.fromEntries(
              entries.map(entry => entry.split('='))
            );
            continue;
          }

          continue;
        }

        // Validate required fields, but skip incomplete entries instead of throwing fatal errors
        if (
          item.nickname == null ||
          item.identity == null ||
          item.date == null ||
          item.hour == null ||
          item.hostname == null ||
          item.orport == null ||
          item.dirport == null ||
          item.microdesc == null ||
          item.flags == null
        ) {
          // Determine which fields are missing for better error reporting
          const missingFields = [];
          if (item.nickname == null) missingFields.push('nickname');
          if (item.identity == null) missingFields.push('identity');
          if (item.date == null) missingFields.push('date');
          if (item.hour == null) missingFields.push('hour');
          if (item.hostname == null) missingFields.push('hostname');
          if (item.orport == null) missingFields.push('orport');
          if (item.dirport == null) missingFields.push('dirport');
          if (item.microdesc == null) missingFields.push('microdesc');
          if (item.flags == null) missingFields.push('flags');

          // Track incomplete microdesc entries
          invalidMicrodescs.push({
            index: microdescIndex,
            reason: `missing required fields: ${missingFields.join(', ')}`,
            data: item.nickname
              ? `nickname: ${item.nickname}`
              : 'no nickname available',
          });

          // Skip incomplete microdesc entries and continue parsing
          continue;
        }

        // Set default values for optional fields if missing
        item.version ??= 'unknown';
        item.entries ??= {};
        item.bandwidth ??= {};

        microdescs.push(item as Microdesc.Head);
        continue;
      }

      continue;
    }

    consensus.authorities = authorities;
    consensus.microdescs = microdescs;
    consensus.signatures = signatures;

    // Log invalid microdescs if any were found
    if (invalidMicrodescs.length > 0) {
      console.error(
        `Consensus parsing completed: ${microdescs.length} valid microdescs, ${invalidMicrodescs.length} invalid entries`
      );

      // Log up to 2 examples
      const examples = invalidMicrodescs.slice(0, 2);
      examples.forEach((invalid, idx) => {
        console.error(
          `Example ${idx + 1}: Entry ${invalid.index} - ${invalid.reason}`
        );
        if (invalid.data) {
          console.error(`  Data: ${invalid.data}`);
        }
      });

      if (invalidMicrodescs.length > 2) {
        console.error(
          `  ... and ${invalidMicrodescs.length - 2} more invalid entries`
        );
      }
    }

    // Compute and store the full text hash for verification when reconstructing
    consensus.fullTextHash = await computeFullConsensusHash(text);

    // Store the signature portion (everything after preimage)
    assert(consensus.preimage, 'Missing preimage');
    consensus.signatureText = text.slice(consensus.preimage.length);

    return consensus as Consensus;
  }

  export async function verifyOrThrow(
    circuit: Circuit,
    consensus: Consensus,
    signal = new AbortController().signal,
    certificateManager?: {
      getCertificates: (
        circuit: Circuit,
        fingerprints: string[]
      ) => Promise<Certificate[]>;
    }
  ) {
    // Limit concurrent certificate fetches to 10
    const limit = pLimit(10);

    // Filter signatures that need verification
    const signaturesNeedingVerification = consensus.signatures.filter(
      it => it.algorithm === 'sha256' && Authority.trusteds.has(it.identity)
    );

    const startTime = Date.now();
    let certificates: Certificate[];

    if (certificateManager) {
      // Use certificate manager for cached certificates
      const fingerprints = signaturesNeedingVerification.map(
        sig => sig.identity
      );
      certificates = await certificateManager.getCertificates(
        circuit,
        fingerprints
      );
      console.log(
        `Retrieved ${certificates.length} certs (cached/fetched) in ${Date.now() - startTime}ms`
      );
    } else {
      // Fetch all certificates in parallel (with concurrency limit)
      const certificatePromises = signaturesNeedingVerification.map(sig =>
        limit(() => Certificate.fetchOrThrow(circuit, sig.identity, signal))
      );
      certificates = await Promise.all(certificatePromises);
      console.log(
        `Fetched ${certificates.length} certs in ${Date.now() - startTime}ms`
      );
    }

    // Verify all signatures
    let count = 0;

    for (let i = 0; i < signaturesNeedingVerification.length; i++) {
      const it = signaturesNeedingVerification[i];
      const certificate = certificates[i];

      assert(certificate != null, `Missing certificate for ${it.identity}`);

      const signed = Bytes.fromUtf8(consensus.preimage);
      const hashed = new Uint8Array(
        await crypto.subtle.digest('SHA-256', signed)
      );

      using signingKey = Base64.get()
        .getOrThrow()
        .decodePaddedOrThrow(certificate.signingKey);

      const algorithmAsn1 = ASN1.ObjectIdentifier.create(
        undefined,
        OIDs.keys.rsaEncryption
      ).toDER();
      const algorithmId = new X509.AlgorithmIdentifier(
        algorithmAsn1,
        ASN1.Null.create().toDER()
      );
      const subjectPublicKey = ASN1.BitString.create(
        undefined,
        0,
        signingKey.bytes
      ).toDER();
      const subjectPublicKeyInfo = new X509.SubjectPublicKeyInfo(
        algorithmId,
        subjectPublicKey
      );

      const publicKey = X509.writeToBytesOrThrow(subjectPublicKeyInfo);

      using signature = Base64.get()
        .getOrThrow()
        .decodePaddedOrThrow(it.signature);

      using signatureM = new RsaWasm.Memory(signature.bytes);
      using hashedM = new RsaWasm.Memory(hashed);
      using publicKeyM = new RsaWasm.Memory(publicKey);

      using publicKeyX = RsaWasm.RsaPublicKey.from_public_key_der(publicKeyM);
      const verified = publicKeyX.verify_pkcs1v15_unprefixed(
        hashedM,
        signatureM
      );

      assert(verified === true, `Could not verify`);

      count++;
    }

    assert(count >= 3, `Not enough signatures`);

    return true;
  }

  export interface Certificate {
    readonly version: number;
    readonly fingerprint: string;
    readonly published: Date;
    readonly expires: Date;
    readonly identityKey: string;
    readonly signingKey: string;
    readonly crossCert: string;

    readonly preimage: string;
    readonly signature: string;
  }

  export namespace Certificate {
    export async function fetchAllOrThrow(
      circuit: Circuit,
      signal = new AbortController().signal
    ) {
      const stream = await circuit.openDirOrThrow({}, signal);
      const response = await fetch(`http://localhost/tor/keys/fp/all.z`, {
        stream: stream.outer,
        signal,
      });

      assert(response.ok, `Could not fetch`);

      const certificates = parseOrThrow(await response.text());

      const verifieds = await Promise.all(certificates.map(verifyOrThrow));

      assert(!verifieds.some(result => result !== true), `Could not verify`);

      return certificates;
    }

    export async function fetchOrThrow(
      circuit: Circuit,
      fingerprint: string,
      signal = new AbortController().signal
    ) {
      const stream = await circuit.openDirOrThrow(undefined, signal);
      const response = await fetch(
        `http://localhost/tor/keys/fp/${fingerprint}.z`,
        { stream: stream.outer, signal }
      );

      const [certificate] = parseOrThrow(await response.text());

      assert(response.ok, `Could not fetch`);

      assert(certificate != null, `Missing certificate`);

      assert((await verifyOrThrow(certificate)) === true, `Could not verify`);

      return certificate;
    }

    export async function verifyOrThrow(cert: Certificate) {
      using identityKey = Base64.get()
        .getOrThrow()
        .decodePaddedOrThrow(cert.identityKey);

      const identity = new Uint8Array(
        await crypto.subtle.digest('SHA-1', identityKey.bytes)
      );
      const fingerprint = Base16.get().getOrThrow().encodeOrThrow(identity);

      assert(
        fingerprint.toLowerCase() === cert.fingerprint.toLowerCase(),
        `Fingerprint mismatch`
      );

      const signed = Bytes.fromUtf8(cert.preimage);
      const hashed = new Uint8Array(
        await crypto.subtle.digest('SHA-1', signed)
      );

      const algorithmAsn1 = ASN1.ObjectIdentifier.create(
        undefined,
        OIDs.keys.rsaEncryption
      ).toDER();
      const algorithmId = new X509.AlgorithmIdentifier(
        algorithmAsn1,
        ASN1.Null.create().toDER()
      );
      const subjectPublicKey = ASN1.BitString.create(
        undefined,
        0,
        identityKey.bytes
      ).toDER();
      const subjectPublicKeyInfo = new X509.SubjectPublicKeyInfo(
        algorithmId,
        subjectPublicKey
      );

      const publicKey = X509.writeToBytesOrThrow(subjectPublicKeyInfo);

      using signature = Base64.get()
        .getOrThrow()
        .decodePaddedOrThrow(cert.signature);

      using hashedM = new RsaWasm.Memory(hashed);
      using publicKeyM = new RsaWasm.Memory(publicKey);
      using signatureM = new RsaWasm.Memory(signature.bytes);

      using publicKeyX = RsaWasm.RsaPublicKey.from_public_key_der(publicKeyM);
      const verified = publicKeyX.verify_pkcs1v15_unprefixed(
        hashedM,
        signatureM
      );

      assert(verified === true, `Could not verify`);

      return true;
    }

    export function parseOrThrow(text: string) {
      const lines = text.split('\n');

      const items: Certificate[] = [];

      for (const i = { x: 0 }; i.x < lines.length; i.x++) {
        if (lines[i.x].startsWith('dir-key-certificate-version ')) {
          const start = i.x;

          const cert: Partial<Mutable<Certificate>> = {};

          const [, version] = lines[i.x].split(' ');
          cert.version = Number(version);

          for (i.x++; i.x < lines.length; i.x++) {
            if (lines[i.x].startsWith('dir-key-certificate-version ')) {
              i.x--;
              break;
            }

            if (lines[i.x].startsWith('fingerprint ')) {
              const [, fingerprint] = lines[i.x].split(' ');
              cert.fingerprint = fingerprint;
              continue;
            }

            if (lines[i.x].startsWith('dir-key-published ')) {
              const published = lines[i.x].split(' ').slice(1).join(' ');
              cert.published = new Date(published + ' UTC');
              continue;
            }

            if (lines[i.x].startsWith('dir-key-expires ')) {
              const expires = lines[i.x].split(' ').slice(1).join(' ');
              cert.expires = new Date(expires + ' UTC');
              continue;
            }

            if (lines[i.x] === 'dir-identity-key') {
              i.x++;

              cert.identityKey = readRsaPublicKeyOrThrow(lines, i);
              continue;
            }

            if (lines[i.x] === 'dir-signing-key') {
              i.x++;

              cert.signingKey = readRsaPublicKeyOrThrow(lines, i);
              continue;
            }

            if (lines[i.x] === 'dir-key-crosscert') {
              i.x++;

              cert.crossCert = readIdSignatureOrThrow(lines, i);
              continue;
            }

            if (lines[i.x] === 'dir-key-certification') {
              i.x++;
              cert.preimage = lines.slice(start, i.x).join('\n') + '\n';
              cert.signature = readSignatureOrThrow(lines, i);
              continue;
            }

            continue;
          }

          assert(cert.version != null, 'Missing version');
          assert(cert.fingerprint != null, 'Missing fingerprint');
          assert(cert.published != null, 'Missing published');
          assert(cert.expires != null, 'Missing expires');
          assert(cert.identityKey != null, 'Missing identityKey');
          assert(cert.signingKey != null, 'Missing signingKey');
          assert(cert.crossCert != null, 'Missing crossCert');
          assert(cert.signature != null, 'Missing certification');

          items.push(cert as Certificate);
          continue;
        }

        continue;
      }

      return items;
    }
  }

  export type Microdesc = Microdesc.Head & Microdesc.Body;

  export namespace Microdesc {
    export interface Head {
      readonly nickname: string;
      readonly identity: string;
      readonly date: string;
      readonly hour: string;
      readonly hostname: string;
      readonly orport: number;
      readonly dirport: number;
      readonly ipv6?: string;
      readonly microdesc: string;
      readonly flags: string[];
      readonly version: string;
      readonly entries: Record<string, string>;
      readonly bandwidth: Record<string, string>;
    }

    export interface Body {
      readonly onionKey: string;
      readonly ntorOnionKey: string;
      readonly idEd25519: string;
    }

    export async function fetchBodyOrThrow(
      circuit: Circuit,
      microdescHash: string,
      signal = new AbortController().signal
    ) {
      const stream = await circuit.openDirOrThrow({}, signal);
      const response = await fetch(
        `http://localhost/tor/micro/d/${microdescHash}.z`,
        { stream: stream.outer, signal }
      );

      assert(
        response.ok,
        `Could not fetch ${response.status} ${response.statusText}`
      );

      const buffer = await response.arrayBuffer();
      const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', buffer)
      );

      const digest64 = Base64.get().getOrThrow().encodeUnpaddedOrThrow(digest);

      assert(digest64 === microdescHash, `Digest mismatch`);

      const text = Bytes.toUtf8(new Uint8Array(buffer));
      const [data] = parseOrThrow(text);

      assert(data != null, `Empty microdescriptor`);

      return data;
    }

    export async function fetchOrThrow(
      circuit: Circuit,
      ref: Head,
      signal = new AbortController().signal
    ) {
      const data = await fetchBodyOrThrow(circuit, ref.microdesc, signal);

      return { ...ref, ...data } as Microdesc;
    }

    export async function fetchManyOrThrow(
      circuit: Circuit,
      refs: Head[],
      signal = new AbortController().signal
    ): Promise<Microdesc[]> {
      if (refs.length === 0) return [];

      // Tor directory servers typically limit batch requests to ~92 microdescriptors
      // We'll use a conservative limit of 80 to stay well within bounds
      const BATCH_SIZE = 80;
      const batches: Head[][] = [];

      for (let i = 0; i < refs.length; i += BATCH_SIZE) {
        // TODO: integration test with multiple batches
        batches.push(refs.slice(i, i + BATCH_SIZE));
      }

      const hashToBodyMap = new Map<string, { body: Body; rawText: string }>();

      for (const batch of batches) {
        const hashes = batch.map(ref => ref.microdesc);
        const stream = await circuit.openDirOrThrow({}, signal);
        const hashesPath = hashes.join('-');
        const response = await fetch(
          `http://localhost/tor/micro/d/${hashesPath}.z`,
          { stream: stream.outer, signal }
        );

        if (!response.ok) {
          // Note: we cannot use assert here because it is critical that we only
          // read the response if needed
          throw new Error(
            `Could not fetch batch ${response.status} ${response.statusText}: ${await response.text()}`
          );
        }

        const buffer = await response.arrayBuffer();
        const text = Bytes.toUtf8(new Uint8Array(buffer));
        const bodiesWithText = parseWithRawTextOrThrow(text);

        assert(
          bodiesWithText.length === batch.length,
          `Expected ${batch.length} microdescriptors but got ${bodiesWithText.length}`
        );

        for (let idx = 0; idx < bodiesWithText.length; idx++) {
          const { body, rawText } = bodiesWithText[idx];
          // Convert text to bytes for hash calculation
          const encoder = new TextEncoder();
          const rawBytes = encoder.encode(rawText);
          const digest = new Uint8Array(
            await crypto.subtle.digest('SHA-256', rawBytes)
          );
          const calculatedHash = Base64.get()
            .getOrThrow()
            .encodeUnpaddedOrThrow(digest);

          // Store in map using calculated hash
          hashToBodyMap.set(calculatedHash, { body, rawText });
        }
      }

      // Combine heads with bodies using hash matching instead of position
      const result: Microdesc[] = [];
      const missingHashes: string[] = [];

      for (const ref of refs) {
        const entry = hashToBodyMap.get(ref.microdesc);
        if (!entry) {
          missingHashes.push(ref.microdesc);
          continue;
        }
        result.push({ ...ref, ...entry.body } as Microdesc);
      }

      assert(
        missingHashes.length === 0,
        `${missingHashes.length} requested microdesc(s) not found in response: ${missingHashes.slice(0, 3).join(', ')}${missingHashes.length > 3 ? '...' : ''}`
      );

      return result;
    }

    export function parseWithRawTextOrThrow(text: string) {
      const lines = text.split('\n');

      const items: Array<{ body: Body; rawText: string }> = [];

      for (const i = { x: 0 }; i.x < lines.length; i.x++) {
        if (lines[i.x] === 'onion-key') {
          const startLine = i.x;
          i.x++;

          const item: Partial<Mutable<Body>> = {};
          item.onionKey = readRsaPublicKeyOrThrow(lines, i);

          for (i.x++; i.x < lines.length; i.x++) {
            if (lines[i.x] === 'onion-key') {
              i.x--;
              break;
            }

            if (lines[i.x].startsWith('ntor-onion-key ')) {
              const [, ntorOnionKey] = lines[i.x].split(' ');
              item.ntorOnionKey = ntorOnionKey;
              continue;
            }

            if (lines[i.x].startsWith('id ed25519 ')) {
              const [, , idEd25519] = lines[i.x].split(' ');
              item.idEd25519 = idEd25519;
              continue;
            }

            continue;
          }

          assert(item.onionKey != null, 'Missing onion-key');
          assert(item.ntorOnionKey != null, 'Missing ntor-onion-key');
          assert(item.idEd25519 != null, 'Missing id ed25519');

          // Extract the raw text for this microdesc (for hash verification)
          const endLine = i.x + 1;
          const itemLines = lines.slice(startLine, endLine);

          while (itemLines.slice(-1)[0]?.trim() === '') {
            itemLines.pop(); // trim trailing newlines
          }

          const rawText = itemLines.join('\n') + '\n';

          items.push({ body: item as Body, rawText });
          continue;
        }

        continue;
      }

      return items;
    }

    export function parseOrThrow(text: string) {
      return parseWithRawTextOrThrow(text).map(item => item.body);
    }
  }
}

function readRsaPublicKeyOrThrow(lines: string[], i: { x: number }) {
  assert(
    lines[i.x] === '-----BEGIN RSA PUBLIC KEY-----',
    'Missing BEGIN RSA PUBLIC KEY'
  );

  let text = '';

  for (i.x++; i.x < lines.length; i.x++) {
    if (lines[i.x] === '-----END RSA PUBLIC KEY-----') return text;
    text += lines[i.x];
  }

  assert(false, 'Missing END RSA PUBLIC KEY');
}

function readSignatureOrThrow(lines: string[], i: { x: number }) {
  assert(lines[i.x] === '-----BEGIN SIGNATURE-----', 'Missing BEGIN SIGNATURE');

  let text = '';

  for (i.x++; i.x < lines.length; i.x++) {
    if (lines[i.x] === '-----END SIGNATURE-----') return text;
    text += lines[i.x];
  }

  assert(false, 'Missing END SIGNATURE');
}

function readIdSignatureOrThrow(lines: string[], i: { x: number }) {
  assert(
    lines[i.x] === '-----BEGIN ID SIGNATURE-----',
    'Missing BEGIN ID SIGNATURE'
  );

  let text = '';

  for (i.x++; i.x < lines.length; i.x++) {
    if (lines[i.x] === '-----END ID SIGNATURE-----') return text;
    text += lines[i.x];
  }

  assert(false, 'Missing END ID SIGNATURE');
}
