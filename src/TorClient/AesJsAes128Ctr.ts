/**
 * Synchronous AES-128 in CTR mode using aes-js library.
 * This is a drop-in replacement for @hazae41/aes.wasm's Aes128Ctr128BEKey.
 *
 * Uses aes-js for pure JavaScript AES implementation.
 */

import AES from 'aes-js';

/**
 * Synchronous AES-128-CTR key with auto-incrementing counter
 */
export class AesJsAes128Ctr {
  private modeOfOperation: AES.ModeOfOperation.ModeOfOperationCTR;
  private counter: Uint8Array;

  /**
   * Create a new AES-128-CTR key
   * @param keyBytes 16-byte AES key
   * @param counterBytes 16-byte initial counter value (typically zeros)
   */
  constructor(keyBytes: Uint8Array, counterBytes: Uint8Array) {
    if (keyBytes.length !== 16) {
      throw new Error('Key must be 16 bytes for AES-128');
    }
    if (counterBytes.length !== 16) {
      throw new Error('Counter must be 16 bytes');
    }

    // Copy the counter so we don't modify the input
    this.counter = new Uint8Array(counterBytes);

    // Create counter object from the bytes
    const counterObj = new AES.Counter(Array.from(this.counter));

    // Create CTR mode cipher
    this.modeOfOperation = new AES.ModeOfOperation.ctr(keyBytes, counterObj);
  }

  /**
   * Apply AES-CTR keystream to data in-place (XOR operation)
   * Automatically increments counter by the number of blocks processed
   *
   * @param data Data to XOR with keystream
   */
  apply_keystream(data: Uint8Array): void {
    // aes-js.ModeOfOperation.ctr.encrypt does XOR by default for CTR mode
    // It modifies the data in-place and returns the encrypted data
    const encrypted = this.modeOfOperation.encrypt(data);

    // Copy the encrypted result back to data
    data.set(encrypted);

    // Update our internal counter to track state
    const blockCount = Math.ceil(data.length / 16);
    this.incrementCounter(blockCount);
  }

  /**
   * Increment the counter by a given number of blocks
   * Handles overflow correctly for big-endian counter
   */
  private incrementCounter(blockCount: number): void {
    let carry = blockCount;

    // Increment from the end of the array (big-endian)
    for (let i = 15; i >= 0 && carry > 0; i--) {
      const sum = (this.counter[i] + carry) & 0xff;
      this.counter[i] = sum;
      carry = (this.counter[i] + carry) >>> 8;
    }
  }

  /**
   * Resource cleanup (for 'using' statements)
   */
  [Symbol.dispose](): void {
    // No resources to clean up
  }

  /**
   * Async resource cleanup (for async context managers)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    // No cleanup needed
  }
}
