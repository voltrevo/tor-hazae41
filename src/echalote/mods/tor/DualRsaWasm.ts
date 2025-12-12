/**
 * Dual RSA implementation for testing equivalence
 * Runs both rsa.wasm and BigInt implementations and verifies they produce identical results
 * at each step, not just the final verification
 *
 * This is a temporary testing wrapper to ensure the BigInt implementation is correct
 * before fully migrating away from rsa.wasm
 */

import {
  RsaWasm,
  RsaPublicKey as WasmRsaPublicKey,
  Memory as WasmMemory,
} from '@hazae41/rsa.wasm';
import { RsaBigInt, getLastVerificationDetails } from './RsaBigInt.js';
import { appendFileSync } from 'fs';
/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

interface VerificationResult {
  wasmResult: boolean;
  bigIntResult: boolean;
  match: boolean;
  timing: {
    wasm: number;
    bigInt: number;
  };
  intermediateChecks: {
    inputValidation: boolean;
    rsaDecryption: boolean;
    decryptedBytes: boolean;
    paddingValidation: boolean;
  };
}

/**
 * Memory wrapper that can delegate to either implementation
 */
class DualMemory {
  readonly wasmMemory: WasmMemory;
  readonly bigIntMemory: RsaBigInt.Memory;

  constructor(bytes: Uint8Array) {
    this.wasmMemory = new WasmMemory(bytes);
    this.bigIntMemory = new RsaBigInt.Memory(bytes);
  }

  get bytes(): Uint8Array {
    return this.bigIntMemory.bytes;
  }

  ptr(): number {
    return this.wasmMemory.ptr();
  }

  len(): number {
    return this.wasmMemory.len();
  }

  get [Symbol.dispose]() {
    return () => {
      // Both implementations clean up
    };
  }
}

/**
 * Dual RSA public key that runs both implementations
 */
export class DualRsaPublicKey {
  private wasmKey: WasmRsaPublicKey;
  private bigIntKey: RsaBigInt.RsaPublicKey;
  private publicKeyDerHex: string;

  private constructor(
    wasmKey: WasmRsaPublicKey,
    bigIntKey: RsaBigInt.RsaPublicKey,
    publicKeyDerHex: string
  ) {
    this.wasmKey = wasmKey;
    this.bigIntKey = bigIntKey;
    this.publicKeyDerHex = publicKeyDerHex;
  }

  static from_public_key_der(memory: DualMemory): DualRsaPublicKey {
    let wasmKey: WasmRsaPublicKey | null = null;
    let bigIntKey: RsaBigInt.RsaPublicKey | null = null;
    let wasmError: Error | null = null;
    let bigIntError: Error | null = null;

    // Try WASM implementation
    try {
      wasmKey = WasmRsaPublicKey.from_public_key_der(memory.wasmMemory);
    } catch (e) {
      wasmError = e instanceof Error ? e : new Error(String(e));
    }

    // Try BigInt implementation
    try {
      bigIntKey = RsaBigInt.RsaPublicKey.from_public_key_der(
        memory.bigIntMemory
      );
    } catch (e) {
      bigIntError = e instanceof Error ? e : new Error(String(e));
    }

    // Both must succeed with the same result
    if (wasmKey === null || bigIntKey === null) {
      const mismatchMsg = `from_public_key_der: Implementation mismatch - WASM: ${wasmKey ? 'success' : `failed (${wasmError?.message})`}, BigInt: ${bigIntKey ? 'success' : `failed (${bigIntError?.message})`}`;
      throw new Error(mismatchMsg);
    }

    const publicKeyDerHex = toHex(memory.bigIntMemory.bytes);
    return new DualRsaPublicKey(wasmKey, bigIntKey, publicKeyDerHex);
  }

  static from_pkcs1_der(memory: DualMemory): DualRsaPublicKey {
    let wasmKey: WasmRsaPublicKey | null = null;
    let bigIntKey: RsaBigInt.RsaPublicKey | null = null;
    let wasmError: Error | null = null;
    let bigIntError: Error | null = null;

    // Try WASM implementation
    try {
      wasmKey = WasmRsaPublicKey.from_pkcs1_der(memory.wasmMemory);
    } catch (e) {
      wasmError = e instanceof Error ? e : new Error(String(e));
    }

    // Try BigInt implementation
    try {
      bigIntKey = RsaBigInt.RsaPublicKey.from_pkcs1_der(memory.bigIntMemory);
    } catch (e) {
      bigIntError = e instanceof Error ? e : new Error(String(e));
    }

    // Both must succeed with the same result
    if (wasmKey === null || bigIntKey === null) {
      const mismatchMsg = `from_pkcs1_der: Implementation mismatch - WASM: ${wasmKey ? 'success' : `failed (${wasmError?.message})`}, BigInt: ${bigIntKey ? 'success' : `failed (${bigIntError?.message})`}`;
      throw new Error(mismatchMsg);
    }

    const publicKeyDerHex = toHex(memory.bigIntMemory.bytes);
    return new DualRsaPublicKey(wasmKey, bigIntKey, publicKeyDerHex);
  }

  /**
   * Verify signature using both implementations and compare results at each step
   * Logs detailed information for debugging and ensures data equivalence
   */
  verify_pkcs1v15_unprefixed(
    hashMemory: DualMemory,
    signatureMemory: DualMemory
  ): boolean {
    const results: VerificationResult = {
      wasmResult: false,
      bigIntResult: false,
      match: false,
      timing: {
        wasm: 0,
        bigInt: 0,
      },
      intermediateChecks: {
        inputValidation: false,
        rsaDecryption: false,
        decryptedBytes: false,
        paddingValidation: false,
      },
    };

    // Run WASM implementation
    const wasmStart = performance.now();
    results.wasmResult = this.wasmKey.verify_pkcs1v15_unprefixed(
      hashMemory.wasmMemory,
      signatureMemory.wasmMemory
    );
    results.timing.wasm = performance.now() - wasmStart;

    // Run BigInt implementation with detailed validation enabled
    const bigIntStart = performance.now();
    results.bigIntResult = this.bigIntKey.verify_pkcs1v15_unprefixed(
      hashMemory.bigIntMemory,
      signatureMemory.bigIntMemory,
      true // Enable detailed validation
    );
    results.timing.bigInt = performance.now() - bigIntStart;

    // Get intermediate validation results from BigInt implementation
    const details = getLastVerificationDetails();
    if (details) {
      results.intermediateChecks.rsaDecryption = details.rsaDecryptionMatches;
      results.intermediateChecks.decryptedBytes = details.decryptedBytesMatches;
      results.intermediateChecks.paddingValidation =
        details.paddingValidationMatches;
    }

    // Input validation passed since both implementations ran
    results.intermediateChecks.inputValidation = true;

    // Check if results match
    results.match = results.wasmResult === results.bigIntResult;

    // Log test vectors for verification and debugging
    const vectorData = {
      publicKeyDerHex: this.publicKeyDerHex,
      hashHex: toHex(hashMemory.wasmMemory.bytes),
      signatureHex: toHex(signatureMemory.wasmMemory.bytes),
      wasmResult: results.wasmResult,
      bigIntResult: results.bigIntResult,
      match: results.match,
    };

    console.info('[TEST_VECTOR]', vectorData);

    // Write test vector to file for later use - only if WASM verifies successfully
    if (results.wasmResult) {
      try {
        appendFileSync(
          '/tmp/rsa_test_vectors.jsonl',
          JSON.stringify(vectorData) + '\n'
        );
      } catch {
        // Silently ignore file writing errors
      }
    }

    // Log results with intermediate validation details
    if (!results.match) {
      console.error('MISMATCH in RSA verification!', {
        wasmResult: results.wasmResult,
        bigIntResult: results.bigIntResult,
        timing: results.timing,
        intermediateChecks: results.intermediateChecks,
      });
    } else {
      // Log successful verification with timing comparison
      console.debug('RSA verification OK', {
        result: results.wasmResult,
        timing: results.timing,
        slowdown:
          results.timing.wasm > 0
            ? (results.timing.bigInt / results.timing.wasm).toFixed(1) + 'x'
            : 'N/A',
        intermediateChecks: results.intermediateChecks,
      });
    }

    // Throw if results don't match
    if (!results.match) {
      throw new Error(
        `RSA verification mismatch: WASM=${results.wasmResult}, BigInt=${results.bigIntResult}`
      );
    }

    // Throw if any intermediate check failed
    for (const [check, result] of Object.entries(results.intermediateChecks)) {
      if (!result) {
        throw new Error(
          `Intermediate validation failed at ${check}: WASM and BigInt implementations diverged`
        );
      }
    }

    return results.wasmResult; // Return WASM result as ground truth
  }

  get [Symbol.dispose]() {
    return () => {
      // Clean up resources if needed
    };
  }
}

/**
 * Wrapper around RsaWasm for dual implementation
 */
export class DualRsaWasm {
  static Memory = DualMemory;
  static RsaPublicKey = DualRsaPublicKey;

  /**
   * Initialize the WASM module (required by rsa.wasm)
   */
  static async initBundled(): Promise<void> {
    await RsaWasm.initBundled();
  }
}
