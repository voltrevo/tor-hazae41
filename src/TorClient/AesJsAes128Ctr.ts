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

  /**
   * Create a new AES-128-CTR key
   * @param keyBytes 16-byte AES key
   * @param counterBytes 16-byte initial counter value (typically zeros)
   */
  constructor(keyBytes: Uint8Array) {
    if (keyBytes.length !== 16) {
      throw new Error('Key must be 16 bytes for AES-128');
    }

    // Create CTR mode cipher
    this.modeOfOperation = new AES.ModeOfOperation.ctr(
      keyBytes,
      new AES.Counter(0)
    );
  }

  /**
   * Apply AES-CTR keystream to data in-place (XOR operation)
   *
   * @param data Data to XOR with keystream
   */
  async apply_keystream(data: Uint8Array): Promise<void> {
    await Promise.resolve();

    // aes-js.ModeOfOperation.ctr.encrypt does XOR by default for CTR mode
    // It modifies the data in-place and returns the encrypted data
    const encrypted = this.modeOfOperation.encrypt(data);

    // Copy the encrypted result back to data
    data.set(encrypted);
  }
}
