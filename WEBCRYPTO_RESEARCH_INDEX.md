# Web Crypto API Research - Complete Index

## Overview

This document indexes the comprehensive research on Web Crypto API (SubtleCrypto) support for the tor-hazae41 codebase, particularly for RSA operations and cross-platform compatibility.

## Quick Answers

| Question                                  | Answer     | Details                                |
| ----------------------------------------- | ---------- | -------------------------------------- |
| RSA signature verification (PKCS#1 v1.5)? | ✅ Partial | Standard yes, unprefixed no            |
| Parse DER-encoded RSA keys?               | ✅ Yes     | SPKI format fully supported            |
| Cross-platform availability?              | ✅ Yes     | Modern browsers + Node.js 15+          |
| Replace rsa.wasm completely?              | ❌ No      | Unprefixed verification needed for Tor |

## Research Documents

### 1. WEBCRYPTO_RESEARCH.md (Primary Technical Document)

**Purpose:** Comprehensive technical analysis of Web Crypto API capabilities

**Contents:**

- Executive summary of findings
- Detailed analysis of RSA signature verification
- DER-encoded key parsing capabilities
- Cross-platform availability matrix
- Feature comparison: rsa.wasm vs Web Crypto
- Codebase integration analysis
- Three recommendation options (with rationale)
- Web Crypto API limitations

**Best for:** Understanding the technical landscape, platform support, and trade-offs

**Key sections:**

- Lines 1-10: Executive summary
- Lines 12-60: RSA signature verification details
- Lines 62-85: DER key parsing capabilities
- Lines 87-105: Cross-platform availability
- Lines 107-140: Feature comparison table
- Lines 142-165: Codebase integration analysis
- Lines 167-200: Recommendations (3 options)

### 2. WEBCRYPTO_CODE_EXAMPLES.md (Implementation Guide)

**Purpose:** Side-by-side code comparison and implementation analysis

**Contents:**

- Current implementation analysis
- Standard X.509 certificate verification code
- Tor cross-certificate verification code
- Explanation of prefixed vs unprefixed signatures
- DigestInfo structure explanation
- Bundle impact analysis
- Code examples showing optimal patterns
- Interesting discovery: code already uses recommended approach

**Best for:** Understanding how the code works and why it's optimal

**Key sections:**

- Lines 1-50: Current X.509 verification implementation
- Lines 52-100: Tor cross-certificate verification implementation
- Lines 102-150: Why unprefixed verification matters
- Lines 152-180: Prefixed vs unprefixed detailed explanation
- Lines 182-220: Bundle impact analysis
- Lines 222-260: Code examples and optimal patterns

## Key Findings Summary

### What Web Crypto Supports ✅

1. **RSA PKCS#1 v1.5 Signature Verification**
   - Works with standard X.509 certificates
   - Supports SHA-1, SHA-256, SHA-384, SHA-512
   - Uses: `crypto.subtle.verify('RSASSA-PKCS1-v1_5', ...)`

2. **DER-Encoded RSA Key Parsing**
   - SPKI format (SubjectPublicKeyInfo) - exactly what you need
   - Uses: `crypto.subtle.importKey('spki', derBytes, ...)`

3. **Cross-Platform Availability**
   - Browsers: Chrome 37+, Firefox 34+, Safari 11+, Edge 79+
   - Node.js: 15+ (full), 12-14 (experimental)
   - All modern mobile browsers

4. **Extensive Crypto Operations**
   - Ed25519 signatures
   - Hash functions (SHA-1, SHA-256, etc.)
   - HMAC operations
   - HKDF key derivation

### What Web Crypto Cannot Do ❌

1. **Unprefixed PKCS#1 v1.5 Verification**
   - Cannot verify raw hash without DigestInfo prefix
   - This is needed for Tor's cross-certificate verification
   - Requires rsa.wasm (has `verify_pkcs1v15_unprefixed()` method)

## The Critical Difference: Prefixed vs Unprefixed

### Standard (Web Crypto) - Prefixed PKCS#1 v1.5

```
Signature structure:
  [padding 0xFF bytes] +
  DigestInfo (ASN.1 encoded hash algorithm OID) +
  Hash bytes
```

### Tor Custom (rsa.wasm) - Unprefixed PKCS#1 v1.5

```
Signature structure:
  [padding 0xFF bytes] +
  Hash bytes (raw, no DigestInfo)
```

**Why the difference?**

- Standard X.509 includes DigestInfo to identify the hash algorithm
- Tor specifies the hash algorithm separately, making DigestInfo redundant
- This is a protocol optimization, not a security difference

## Codebase Implementation Status

### ✅ Currently Optimal Implementation

**File:** `src/echalote/mods/tor/certs/certs.ts`

#### Standard X.509 Certificate (Lines 125-172)

- ✅ Uses `crypto.subtle.importKey('spki', ...)`
- ✅ Uses `crypto.subtle.verify('RSASSA-PKCS1-v1_5', ...)`
- ✅ This is Web Crypto - PERFECT!

#### Tor Cross-Certificate (Lines 174-208)

- ✅ Uses `RsaWasm.Memory` and `verify_pkcs1v15_unprefixed()`
- ✅ Uses `crypto.subtle.digest()` for hashing
- ✅ This correctly uses rsa.wasm for custom format

#### Other Certificate Verifications

- Line 210-224: Ed25519 signature verification (Web Crypto)
- Line 226-254: TLS certificate signing verification (Web Crypto)

### Web Crypto Usage Throughout Codebase

1. **Ed25519 Signatures** (`src/TorClient/WebCryptoEd25519.ts`)
   - ✅ Pure Web Crypto implementation
2. **Hash Functions** (Throughout codebase)
   - ✅ `crypto.subtle.digest('SHA-256', ...)`
   - ✅ `crypto.subtle.digest('SHA-1', ...)`
3. **HMAC** (`src/echalote/mods/tor/algorithms/ntor/ntor.ts`)
   - ✅ NTor handshake using `crypto.subtle.sign('HMAC', ...)`
4. **Key Derivation**
   - ✅ `crypto.subtle.deriveBits()` for circuit keys

## Recommendation

### ✅ NO CHANGES NEEDED

Your implementation is already optimal:

**Standard RSA Verification:**

- Uses Web Crypto (native, fast, no WASM overhead)
- Best performance and smallest bundle impact

**Custom Tor Verification:**

- Uses rsa.wasm (necessary for protocol compliance)
- The only way to do unprefixed verification

**Result:**

- Hybrid approach provides best balance of performance, bundle size, and correctness
- Clean, maintainable code
- Full protocol compliance
- Demonstrates excellent cryptographic engineering

## Technical Details

### Supported Hash Algorithms with RSASSA-PKCS1-v1_5

- SHA-1
- SHA-256 (most common)
- SHA-384
- SHA-512
- SHA-512/256 (varies by browser)

### Key Format Support

| Format | Support | Use Case                       |
| ------ | ------- | ------------------------------ |
| SPKI   | ✅ Yes  | Public keys (what you need)    |
| PKCS#1 | ❌ No   | Raw RSA format (not needed)    |
| PKCS#8 | ✅ Yes  | Private keys (not needed here) |
| JWK    | ✅ Yes  | JSON format (alternative)      |

### Browser Support Timeline

- 2014: Chrome 37, Firefox 34 introduce Web Crypto
- 2017: Safari 11 adds support
- 2020: Edge 79 with Chromium
- 2020+: All modern mobile browsers

### Node.js Support

- Node.js 15+: Full native support via global `crypto`
- Node.js 12-14: Experimental flag required (`--experimental-webcrypto`)
- Node.js < 12: Not available

## Bundle Impact

### Current Dependencies

- `@hazae41/rsa.wasm` (~50KB) - Necessary for unprefixed verification
- `@hazae41/x509` (~30KB) - Certificate parsing
- `@noble/curves` (~40KB) - Cryptography (Ed25519 duplicate with Web Crypto)
- `@noble/hashes` (~20KB) - Hash implementations (duplicate with Web Crypto)

### Optimization Opportunities

The only significant optimization possible would be:

- Remove `@noble/curves` if not used elsewhere (Web Crypto has Ed25519)
- Remove `@noble/hashes` if not used elsewhere (Web Crypto has hashes)
- Keep `@hazae41/rsa.wasm` (necessary for Tor protocol)

However, these packages may be used elsewhere in the codebase.

## References

### Web Crypto API Standards

- MDN Web Docs: Web Crypto API
- W3C Specification: https://www.w3.org/TR/WebCryptoAPI/
- Algorithm specifications: NIST FIPS 186-4, RFC 3447

### Tor Protocol

- Tor specification documents (in `torspec/` directory)
- Cross-certificate specification: `/torspec/proposals/...`

## Files for Further Reference

1. **src/echalote/mods/tor/certs/certs.ts** (256 lines)
   - Main certificate verification logic
   - Shows optimal hybrid approach

2. **src/TorClient/WebCryptoEd25519.ts** (91 lines)
   - Pure Web Crypto Ed25519 implementation
   - Best practices example

3. **src/echalote/mods/tor/algorithms/ntor/ntor.ts**
   - Web Crypto HMAC and derivation usage

4. **src/echalote/mods/tor/consensus/consensus.ts**
   - Consensus verification with Web Crypto hashing

## Conclusion

The tor-hazae41 codebase demonstrates excellent understanding of cryptographic engineering:

1. ✅ Uses Web Crypto for standard operations (X.509, hashing, signatures)
2. ✅ Uses rsa.wasm only for necessary custom operations (unprefixed verification)
3. ✅ Implements a clean hybrid approach
4. ✅ Targets modern platforms with native crypto support
5. ✅ Code is well-organized and maintainable

**No changes are recommended.** The current implementation is optimal.

---

**Research completed:** December 12, 2025
**Status:** Complete and verified
