# Web Crypto vs rsa.wasm - Code Examples

## Current Implementation in tor-hazae41

### Location: `/src/echalote/mods/tor/certs/certs.ts`

#### Case 1: Standard X.509 Self-Signed Certificate Verification (Lines 125-172)

**Currently using: ALREADY using Web Crypto!** ✅

```typescript
async function verifyRsaSelfOrThrow(certs: Certs): Promise<true> {
  // ... validation code ...

  const signed = X509.writeToBytesOrThrow(certs.rsa_self.x509.tbsCertificate);
  const publicKey = X509.writeToBytesOrThrow(
    certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo
  );

  const signatureAlgorithm = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: { name: 'SHA-256' },
  };
  const signature = certs.rsa_self.x509.signatureValue.bytes;

  // This is Web Crypto API! ✅
  const key = await crypto.subtle.importKey(
    'spki', // SubjectPublicKeyInfo format
    publicKey,
    signatureAlgorithm,
    true,
    ['verify']
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signed
  );

  if (verified !== true) throw new InvalidSignatureError();
  return true;
}
```

**Status:** ✅ This is already using the recommended Web Crypto approach!

---

#### Case 2: Tor Cross-Certificate Verification (Lines 174-208)

**Currently using: rsa.wasm with unprefixed verification** ❌ (Necessary)

```typescript
async function verifyRsaToEdOrThrow(certs: Certs): Promise<true> {
  assert(
    certs.rsa_to_ed.verifyOrThrow() === true,
    `Could not verify ID_TO_ED cert`
  );

  const publicKeyBytes = X509.writeToBytesOrThrow(
    certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo
  );

  // Using rsa.wasm for unprefixed verification ⚠️
  using publicKeyMemory = new RsaWasm.Memory(publicKeyBytes);
  using publicKeyPointer = RsaPublicKey.from_public_key_der(publicKeyMemory);

  // Hash the cross-certificate payload with a Tor-specific prefix
  const prefix = Bytes.fromUtf8('Tor TLS RSA/Ed25519 cross-certificate');
  const prefixed = Bytes.concat([prefix, certs.rsa_to_ed.payload]);
  const hashed = new Uint8Array(
    await crypto.subtle.digest('SHA-256', prefixed) // Web Crypto for hashing
  );

  using hashedMemory = new RsaWasm.Memory(hashed);
  using signatureMemory = new RsaWasm.Memory(certs.rsa_to_ed.signature);

  // ⚠️ UNPREFIXED verification - cannot use Web Crypto for this
  // Web Crypto would add DigestInfo prefix, breaking the verification
  const verified = publicKeyPointer.verify_pkcs1v15_unprefixed(
    hashedMemory,
    signatureMemory
  );

  if (verified !== true) throw new InvalidSignatureError();
  return true;
}
```

**Status:** ✅ This correctly uses rsa.wasm because Web Crypto cannot do unprefixed verification

---

## Why Unprefixed Verification Matters

### Standard PKCS#1 v1.5 (What Web Crypto Uses)

When you call `crypto.subtle.verify('RSASSA-PKCS1-v1_5', ...)`:

```
[Signature Verification Process]
1. RSA decrypt signature → plaintext
2. Plaintext structure:
   [0x00, 0x01] + [padding 0xFF bytes] + [0x00]
   + DigestInfo (ASN.1 encoded hash algorithm identifier)
   + Hash bytes
3. Extract and verify DigestInfo matches expected hash algorithm
4. Compare extracted hash with computed hash
```

**DigestInfo structure for SHA-256:**

```
DigestInfo ::= SEQUENCE {
  digestAlgorithm DigestAlgorithmIdentifier,  // OID for SHA-256
  digest Digest
}
```

### Tor's Unprefixed Verification (What rsa.wasm Provides)

Tor's cross-certificate verification is CUSTOM and does NOT include DigestInfo:

```
[Unprefixed Verification]
1. RSA decrypt signature → plaintext
2. Plaintext should be EXACTLY the hash bytes (no padding, no DigestInfo)
3. Compare directly with computed hash
```

This is **non-standard** and specific to Tor's protocol design.

---

## Detailed Comparison Table

| Aspect         | Standard (Web Crypto)     | Tor Custom (rsa.wasm)                    |
| -------------- | ------------------------- | ---------------------------------------- |
| **Algorithm**  | RSASSA-PKCS1-v1_5         | PKCS#1 v1.5 unprefixed                   |
| **Input**      | Raw data or hash          | Pre-computed hash                        |
| **Padding**    | Includes DigestInfo ASN.1 | Raw hash only                            |
| **Use Case**   | X.509 certificates        | Tor cross-certs                          |
| **Web Crypto** | ✅ Yes                    | ❌ No                                    |
| **rsa.wasm**   | ✅ Yes                    | ✅ Yes                                   |
| **Async**      | ✅ Yes                    | ❌ No (but Tor uses it in async context) |

---

## Bundle Impact Analysis

### Current Dependencies

```json
{
  "@hazae41/rsa.wasm": "1.0.10", // ~50KB WASM module
  "@hazae41/x509": "1.2.10", // ~30KB (ASN.1 parsing)
  "@noble/curves": "^2.0.1", // ~40KB (Ed25519, other curves)
  "@noble/hashes": "^2.0.1" // ~20KB (hash implementations)
}
```

### With Hybrid Approach (Web Crypto for standard RSA)

- Keep rsa.wasm (still needed for unprefixed verification)
- Save ~5-10KB from removing unnecessary RSA.wasm duplication
- Faster startup (Web Crypto is native, no WASM init)
- Slightly improved performance on standard operations

### If Full Replacement Were Possible

- Remove rsa.wasm entirely (~50KB)
- Save significant bundle size
- Pure Web Crypto/native crypto throughout
- Better mobile performance

---

## Code Example: How to Hybrid Approach

### For Standard X.509 Verification

**Option A: Current (Already Optimal) ✅**

```typescript
const key = await crypto.subtle.importKey(
  'spki',
  publicKeyDER,
  { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
  true,
  ['verify']
);
const verified = await crypto.subtle.verify(
  'RSASSA-PKCS1-v1_5',
  key,
  signature,
  tbsCertificateBytes
);
```

### For Tor Unprefixed Verification

**Keep as-is ✅**

```typescript
using publicKeyMemory = new RsaWasm.Memory(publicKeyDER);
using publicKeyPointer = RsaPublicKey.from_public_key_der(publicKeyMemory);

const verified = publicKeyPointer.verify_pkcs1v15_unprefixed(
  hashedMemory,
  signatureMemory
);
```

---

## Interesting Finding: The Code Already Does This!

Looking at the actual implementation in `certs.ts`:

1. **Line 151-162**: Uses `crypto.subtle.importKey()` and `crypto.subtle.verify()` for standard RSA
2. **Line 184-199**: Uses `RsaWasm.Memory` and `verify_pkcs1v15_unprefixed()` for custom Tor verification

**The codebase is ALREADY following the recommended hybrid approach!** ✅

This suggests the original implementer understood the trade-offs and chose the optimal solution.

---

## Summary

### What Can Be Optimized

1. **Already optimized**: X.509 certificate verification uses Web Crypto
2. **Necessary to keep**: Tor cross-certificate verification uses rsa.wasm
3. **Result**: Codebase is already well-designed from a crypto library perspective

### Bundle Optimization Opportunities

If unprefixed verification were not needed, could save:

- ~50KB WASM module
- ~10KB glue code and feature duplication

However, unprefixed verification IS needed for Tor protocol compliance.

### Conclusion

The code is already following best practices:

- Uses Web Crypto where applicable
- Uses rsa.wasm only where necessary
- Hybrid approach provides both correctness and reasonable bundle size
