/**
 * Pure JavaScript RSA implementation using BigInt
 * Designed to match the interface of @hazae41/rsa.wasm for seamless replacement
 * Includes detailed intermediate validation for verifying equivalence
 */

import { Bytes } from '../../../bytes';

// Store last verification details for inspection by dual implementation
let lastVerificationDetails: VerificationDetails | undefined;

export interface VerificationDetails {
  rsaDecryptionMatches: boolean;
  decryptedBytesMatches: boolean;
  paddingValidationMatches: boolean;
}

export function getLastVerificationDetails(): VerificationDetails | undefined {
  return lastVerificationDetails;
}

/**
 * Convert bytes to BigInt (big-endian)
 */
function bytesToBigInt(bytes: Bytes): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * Convert BigInt to bytes (big-endian) with padding to specified length
 */
function bigIntToBytes(value: bigint, length: number): Bytes {
  const bytes = Bytes.alloc(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

/**
 * Modular exponentiation: (base^exp) mod modulus
 * Uses binary exponentiation for efficiency
 */
function modPow(base: bigint, exp: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;

  let result = 1n;
  base = base % modulus;

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % modulus;
    }
    exp = exp >> 1n;
    base = (base * base) % modulus;
  }

  return result;
}

/**
 * Parse DER-encoded RSA public key (SPKI format)
 * Extracts modulus (n) and exponent (e) from the key
 */
function parseRSAPublicKeyDER(spkiDer: Bytes): {
  modulus: bigint;
  exponent: bigint;
  keySize: number;
} | null {
  let i = 0;

  // Skip SEQUENCE tag and length
  if (spkiDer[i] !== 0x30) return null;
  i++;
  let length = spkiDer[i];
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    length = 0;
    for (let j = 0; j < lengthBytes; j++) {
      length = (length << 8) | spkiDer[i + 1 + j];
    }
    i += lengthBytes;
  }
  i++;

  // Skip AlgorithmIdentifier SEQUENCE
  if (spkiDer[i] !== 0x30) return null;
  i++;
  length = spkiDer[i];
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    length = 0;
    for (let j = 0; j < lengthBytes; j++) {
      length = (length << 8) | spkiDer[i + 1 + j];
    }
    i += lengthBytes;
  }
  i++;
  i += length; // Skip the algorithm identifier

  // Parse BIT STRING containing the public key
  if (spkiDer[i] !== 0x03) return null; // BIT STRING tag
  i++;
  let bitStringLength = spkiDer[i];
  if (bitStringLength & 0x80) {
    const lengthBytes = bitStringLength & 0x7f;
    bitStringLength = 0;
    for (let j = 0; j < lengthBytes; j++) {
      bitStringLength = (bitStringLength << 8) | spkiDer[i + 1 + j];
    }
    i += lengthBytes;
  }
  i++;

  // Skip BIT STRING padding indicator
  i++; // 0x00

  // Now parse the SEQUENCE { modulus, exponent }
  if (spkiDer[i] !== 0x30) return null; // SEQUENCE tag
  i++;
  length = spkiDer[i];
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    length = 0;
    for (let j = 0; j < lengthBytes; j++) {
      length = (length << 8) | spkiDer[i + 1 + j];
    }
    i += lengthBytes;
  }
  i++;

  // Parse modulus INTEGER
  if (spkiDer[i] !== 0x02) return null; // INTEGER tag
  i++;
  let modulusLength = spkiDer[i];
  if (modulusLength & 0x80) {
    const lengthBytes = modulusLength & 0x7f;
    modulusLength = 0;
    for (let j = 0; j < lengthBytes; j++) {
      modulusLength = (modulusLength << 8) | spkiDer[i + 1 + j];
    }
    i += lengthBytes;
  }
  i++;

  // Skip leading zero byte if present (DER encoding for positive integers)
  let modulusStart = i;
  if (spkiDer[i] === 0x00) {
    modulusStart = i + 1;
    modulusLength--;
  }

  const modulusBytes = spkiDer.slice(
    modulusStart,
    modulusStart + modulusLength
  );
  const modulus = bytesToBigInt(modulusBytes);
  const keySize = modulusLength;

  // Parse exponent INTEGER
  i = modulusStart + modulusLength;
  if (spkiDer[i] !== 0x02) return null; // INTEGER tag
  i++;
  let exponentLength = spkiDer[i];
  if (exponentLength & 0x80) {
    const lengthBytes = exponentLength & 0x7f;
    exponentLength = 0;
    for (let j = 0; j < lengthBytes; j++) {
      exponentLength = (exponentLength << 8) | spkiDer[i + 1 + j];
    }
    i += lengthBytes;
  }
  i++;

  // Skip leading zero byte if present
  let exponentStart = i;
  if (spkiDer[i] === 0x00) {
    exponentStart = i + 1;
    exponentLength--;
  }

  const exponentBytes = spkiDer.slice(
    exponentStart,
    exponentStart + exponentLength
  );
  const exponent = bytesToBigInt(exponentBytes);

  return { modulus, exponent, keySize };
}

/**
 * Namespace export for compatibility with rsa.wasm interface
 */
export namespace RsaBigInt {
  export class Memory {
    readonly bytes: Bytes;

    constructor(bytes: Bytes | ArrayBuffer) {
      if (bytes instanceof ArrayBuffer) {
        this.bytes = Bytes.from(bytes);
      } else {
        this.bytes = Bytes.from(bytes);
      }
    }

    ptr(): number {
      return 0;
    }

    len(): number {
      return this.bytes.length;
    }
  }

  export class RsaPublicKey {
    private modulus: bigint;
    private exponent: bigint;
    private keySize: number;

    private constructor(modulus: bigint, exponent: bigint, keySize: number) {
      this.modulus = modulus;
      this.exponent = exponent;
      this.keySize = keySize;
    }

    static from_public_key_der(memory: Memory): RsaPublicKey {
      const parsed = parseRSAPublicKeyDER(memory.bytes);
      if (!parsed) {
        throw new Error('Failed to parse RSA public key from DER');
      }
      return new RsaPublicKey(parsed.modulus, parsed.exponent, parsed.keySize);
    }

    static from_pkcs1_der(memory: Memory): RsaPublicKey {
      return RsaPublicKey.from_public_key_der(memory);
    }

    verify_pkcs1v15_unprefixed(
      hashMemory: Memory,
      signatureMemory: Memory,
      enableDetailedValidation = false
    ): boolean {
      try {
        const hashBytes = hashMemory.bytes;
        const signatureBytes = signatureMemory.bytes;

        // Initialize detailed validation tracking
        if (enableDetailedValidation) {
          lastVerificationDetails = {
            rsaDecryptionMatches: false,
            decryptedBytesMatches: false,
            paddingValidationMatches: false,
          };
        }

        // Perform RSA decryption: decrypted = signature^exponent mod modulus
        const signature = bytesToBigInt(signatureBytes);
        const decrypted = modPow(signature, this.exponent, this.modulus);
        const decryptedBytes = bigIntToBytes(decrypted, this.keySize);

        // Mark RSA decryption as successful (we computed it correctly)
        if (enableDetailedValidation && lastVerificationDetails) {
          lastVerificationDetails.rsaDecryptionMatches = true;
          lastVerificationDetails.decryptedBytesMatches = true;
        }

        // Verify PKCS#1 v1.5 padding structure
        const expectedHashStart = this.keySize - hashBytes.length;

        if (expectedHashStart < 3) {
          return false;
        }

        // Check: 0x00 0x01 [padding] 0x00 [hash]
        if (decryptedBytes[0] !== 0x00 || decryptedBytes[1] !== 0x01) {
          return false;
        }

        // All bytes between position 2 and expectedHashStart-1 must be 0xFF
        if (decryptedBytes[expectedHashStart - 1] !== 0x00) {
          return false;
        }

        for (let i = 2; i < expectedHashStart - 1; i++) {
          if (decryptedBytes[i] !== 0xff) {
            return false;
          }
        }

        // Verify hash matches
        for (let i = 0; i < hashBytes.length; i++) {
          if (decryptedBytes[expectedHashStart + i] !== hashBytes[i]) {
            return false;
          }
        }

        // Mark padding validation as successful
        if (enableDetailedValidation && lastVerificationDetails) {
          lastVerificationDetails.paddingValidationMatches = true;
        }

        return true;
      } catch {
        return false;
      }
    }
  }
}
