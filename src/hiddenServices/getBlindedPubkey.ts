import { hash } from './hash.js';
import { ed25519 } from '@noble/curves/ed25519.js';

const basePointStr = [
  '(15112221349535400772501151409588531511454012693041857206046113283949847762202,',
  ' 46316835694926478169428394003475163141307993866256225615783033603165251855960)',
].join('');

export async function getBlindedPubkey(
  pubkey: Uint8Array, // aka 'A'
  periodNumber: number,
  periodLength: number,
  secret: string | Uint8Array = Uint8Array.from([])
) {
  const h = await hash(
    'Derive temporary signing key',
    Uint8Array.from([0]),
    pubkey,
    secret,
    basePointStr,
    'key-blind',
    periodNumber,
    periodLength
  );

  // "then clamp the blinding factor 'h' according to the ed25519 spec:"
  h[0] &= 248;
  h[31] &= 63;
  h[31] |= 64;

  // Perform elliptic curve scalar multiplication: A' = h * A
  // This implements the key blinding as defined in the tor spec
  const point = ed25519.Point.fromBytes(pubkey);

  // Convert h (Uint8Array) to BigInt in little-endian format
  let scalarRaw = 0n;
  for (let i = h.length - 1; i >= 0; i--) {
    scalarRaw = (scalarRaw << 8n) | BigInt(h[i]);
  }

  // The clamping operation prepares h for Ed25519's private key format,
  // but the resulting 256-bit value must be reduced modulo the curve order n
  // (which is ~2^252) to get a valid scalar for point multiplication.
  const scalar = ed25519.Point.Fn.create(scalarRaw);

  const blindedPoint = point.multiply(scalar);

  // Return the blinded public key in compressed form (32 bytes)
  return blindedPoint.toBytes();
}

/*

From the tor spec:

<main>
                        <p><a id="rend-spec-v3.txt-A"></a></p>
<h1 id="KEYBLIND"><a class="header" href="#KEYBLIND">Appendix A: Signature scheme with key blinding</a></h1>
<p><a id="rend-spec-v3.txt-A.1"></a></p>
<h2 id="overview"><a class="header" href="#overview">Key derivation overview</a></h2>
<p>As described in [IMD:DIST] and [SUBCRED] above, we require a “key
blinding” system that works (roughly) as follows:</p>
<p>There is a master keypair (sk, pk).</p>
<pre><div class="buttons"><button class="clip-button" title="Copy to clipboard" aria-label="Copy to clipboard"><i class="tooltiptext"></i></button></div><code class="language-text hljs plaintext">        Given the keypair and a nonce n, there is a derivation function
        that gives a new blinded keypair (sk_n, pk_n).  This keypair can
        be used for signing.

        Given only the public key and the nonce, there is a function
        that gives pk_n.

        Without knowing pk, it is not possible to derive pk_n; without
        knowing sk, it is not possible to derive sk_n.

        It's possible to check that a signature was made with sk_n while
        knowing only pk_n.

        Someone who sees a large number of blinded public keys and
        signatures made using those public keys can't tell which
        signatures and which blinded keys were derived from the same
        master keypair.

        You can't forge signatures.

        [TODO: Insert a more rigorous definition and better references.]
</code></pre>
<p><a id="rend-spec-v3.txt-A.2"></a></p>
<h2 id="scheme"><a class="header" href="#scheme">Tor’s key derivation scheme</a></h2>
<p>We propose the following scheme for key blinding, based on Ed25519.</p>
<p>(This is an ECC group, so remember that scalar multiplication is the
trapdoor function, and it’s defined in terms of iterated point
addition. See the Ed25519 paper [Reference ED25519-REFS] for a fairly
clear writeup.)</p>
<p>Let B be the ed25519 basepoint as found in section 5 of [ED25519-B-REF]:</p>
<pre><div class="buttons"><button class="clip-button" title="Copy to clipboard" aria-label="Copy to clipboard"><i class="tooltiptext"></i></button></div><code class="language-text hljs plaintext">      B = (15112221349535400772501151409588531511454012693041857206046113283949847762202,
           46316835694926478169428394003475163141307993866256225615783033603165251855960)
</code></pre>
<p>Assume B has prime order l, so lB=0. Let a master keypair be written as
(a,A), where a is the private key and A is the public key (A=aB).</p>
<p>To derive the key for a nonce N and an optional secret s, compute the
blinding factor like this:</p>
<pre><div class="buttons"><button class="clip-button" title="Copy to clipboard" aria-label="Copy to clipboard"><i class="tooltiptext"></i></button></div><code class="language-text hljs plaintext">           h = SHA3_256(BLIND_STRING | A | s | B | N)
           BLIND_STRING = "Derive temporary signing key" | INT_1(0)
           N = "key-blind" | INT_8(period-number) | INT_8(period_length)
           B = "(1511[...]2202, 4631[...]5960)"

  then clamp the blinding factor 'h' according to the ed25519 spec:

           h[0] &amp;= 248;
           h[31] &amp;= 63;
           h[31] |= 64;

  and do the key derivation as follows:

      private key for the period:

           a' = h a mod l
           RH' = SHA-512(RH_BLIND_STRING | RH)[:32]
           RH_BLIND_STRING = "Derive temporary signing key hash input"

      public key for the period:

           A' = h A = (ha)B
</code></pre>
<p>Generating a signature of M: given a deterministic random-looking r
(see EdDSA paper), take R=rB, S=r+hash(R,A’,M)ah mod l. Send signature
(R,S) and public key A’.</p>
<p>Verifying the signature: Check whether SB = R+hash(R,A’,M)A’.</p>
<pre><div class="buttons"><button class="clip-button" title="Copy to clipboard" aria-label="Copy to clipboard"><i class="tooltiptext"></i></button></div><code class="language-text hljs plaintext">  (If the signature is valid,
       SB = (r + hash(R,A',M)ah)B
          = rB + (hash(R,A',M)ah)B
          = R + hash(R,A',M)A' )

  This boils down to regular Ed25519 with key pair (a', A').
</code></pre>
<p>See [KEYBLIND-REFS] for an extensive discussion on this scheme and
possible alternatives. Also, see [KEYBLIND-PROOF] for a security
proof of this scheme.</p>

                    </main>

*/
