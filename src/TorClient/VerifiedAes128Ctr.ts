/**
 * Dual-implementation AES wrapper for validation during migration.
 *
 * This wrapper runs both the original @hazae41/aes.wasm implementation (trusted)
 * and the new aes-js implementation (candidate) synchronously side-by-side,
 * comparing their outputs to ensure they're identical.
 *
 * Once fully validated in production, we can switch to aes-js only.
 */

import { AesJsAes128Ctr } from './AesJsAes128Ctr';
import { HazaeWasmAes128Ctr } from './HazaeWasmAes128Ctr';

interface VerificationStats {
  totalCalls: number;
  totalBytes: number;
  mismatches: Array<{
    callNumber: number;
    dataLength: number;
    hazaeBytes: Uint8Array;
    aesJsBytes: Uint8Array;
  }>;
}

const stats: VerificationStats = {
  totalCalls: 0,
  totalBytes: 0,
  mismatches: [],
};

/**
 * Wrapper that runs both implementations synchronously and verifies they match
 */
export class VerifiedAes128Ctr {
  private aesJsImpl: AesJsAes128Ctr;
  private hazaeImpl: HazaeWasmAes128Ctr;

  constructor(keyBytes: Uint8Array, counterBytes: Uint8Array) {
    // Create both implementations
    this.aesJsImpl = new AesJsAes128Ctr(keyBytes, counterBytes);
    this.hazaeImpl = new HazaeWasmAes128Ctr(keyBytes, counterBytes);
  }

  /**
   * Apply keystream with verification
   * Runs both implementations synchronously and compares results
   */
  apply_keystream(data: Uint8Array): void {
    const callNumber = stats.totalCalls++;
    const dataLength = data.length;
    stats.totalBytes += dataLength;

    // Create copies for both implementations
    const hazaeData = new Uint8Array(data);
    const aesJsData = new Uint8Array(data);

    // Run both implementations synchronously
    this.hazaeImpl.apply_keystream(hazaeData);
    this.aesJsImpl.apply_keystream(aesJsData);

    // Compare results
    let match = true;
    if (hazaeData.length !== aesJsData.length) {
      match = false;
    } else {
      for (let i = 0; i < hazaeData.length; i++) {
        if (hazaeData[i] !== aesJsData[i]) {
          match = false;
          break;
        }
      }
    }

    if (!match) {
      stats.mismatches.push({
        callNumber,
        dataLength,
        hazaeBytes: new Uint8Array(hazaeData),
        aesJsBytes: new Uint8Array(aesJsData),
      });

      console.warn(
        `AES verification mismatch at call ${callNumber} (${dataLength} bytes)`
      );

      // Print first mismatch detail
      if (stats.mismatches.length === 1) {
        console.error('First mismatch details:');
        console.error('Expected (hazae):', Array.from(hazaeData).slice(0, 32));
        console.error('Actual (aes-js):', Array.from(aesJsData).slice(0, 32));
      }
    }

    // Use the hazae implementation result (trusted original)
    data.set(hazaeData);
  }

  /**
   * Get verification statistics
   */
  static getStats(): VerificationStats {
    return { ...stats };
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    stats.totalCalls = 0;
    stats.totalBytes = 0;
    stats.mismatches = [];
  }

  /**
   * Print verification report
   */
  static printReport(): void {
    console.log('\n=== AES Implementation Verification Report ===');
    console.log(`Total calls: ${stats.totalCalls}`);
    console.log(`Total bytes processed: ${stats.totalBytes}`);
    console.log(`Mismatches found: ${stats.mismatches.length}`);

    if (stats.mismatches.length > 0) {
      console.log('\nMismatch details:');
      stats.mismatches.slice(0, 5).forEach((mismatch, index) => {
        console.log(
          `  ${index + 1}. Call ${mismatch.callNumber} (${mismatch.dataLength} bytes)`
        );
      });

      if (stats.mismatches.length > 5) {
        console.log(`  ... and ${stats.mismatches.length - 5} more`);
      }
    } else {
      console.log(
        '\n✅ All implementations match! aes-js is verified and ready for migration.'
      );
    }
  }

  /**
   * Resource cleanup (for 'using' statements)
   */
  [Symbol.dispose](): void {
    this.aesJsImpl[Symbol.dispose]();
    this.hazaeImpl[Symbol.dispose]();
  }

  /**
   * Async resource cleanup (for async context managers)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.aesJsImpl[Symbol.asyncDispose]();
    await this.hazaeImpl[Symbol.asyncDispose]();
  }
}
