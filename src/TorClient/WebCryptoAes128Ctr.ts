/**
 * WebCrypto-based AES-128 in CTR mode.
 * Uses the native SubtleCrypto API available in Node.js 15+ and modern browsers.
 */

import { Bytes } from '../hazae41/bytes';

/**
 * AES-128-CTR key using WebCrypto with lazy key initialization
 */
export class WebCryptoAes128Ctr {
  private keyPromise: Promise<CryptoKey>;
  private initialCounter: Bytes;
  private bytePosition: bigint = 0n;

  /**
   * Create a new AES-128-CTR key
   * @param keyBytes 16-byte AES key
   * @param counterBytes 16-byte initial counter value (typically zeros)
   */
  constructor(keyBytes: Bytes, counterBytes: Bytes) {
    if (keyBytes.length !== 16) {
      throw new Error('Key must be 16 bytes for AES-128');
    }
    if (counterBytes.length !== 16) {
      throw new Error('Counter must be 16 bytes');
    }

    // Store the initial counter (never modified)
    this.initialCounter = Bytes.from(counterBytes);

    // Store the key import promise for lazy initialization
    this.keyPromise = crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-CTR' },
      false,
      ['encrypt']
    );
  }

  /**
   * Generate keystream bytes in the specified byte range
   * @param start Starting byte position
   * @param end Ending byte position (exclusive)
   * @returns Keystream bytes for the range
   */
  async getKeystream(start: bigint, end: bigint): Promise<Bytes> {
    const cryptoKey = await this.keyPromise;
    const length = Number(end - start);

    // Calculate which block contains the start byte and offset within that block
    const startBlock = start / 16n;
    const startOffset = Number(start % 16n);

    // Calculate how many blocks we need to generate
    const endBlock = (end + 15n) / 16n; // Round up
    const blocksNeeded = Number(endBlock - startBlock);

    // Derive counter for the starting block
    const counter = this.deriveCounter(startBlock);

    // Generate keystream for all needed blocks
    const keystream = Bytes.from(
      await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter, length: 128 },
        cryptoKey,
        Bytes.alloc(blocksNeeded * 16)
      )
    );

    // Extract only the bytes we need
    return keystream.slice(startOffset, startOffset + length);
  }

  /**
   * Derive counter value for a given block number
   */
  private deriveCounter(blockNumber: bigint): Bytes {
    const counter = Bytes.from(this.initialCounter);
    let carry = Number(blockNumber & 0xffffffffn);

    // Increment from the end of the array (big-endian)
    for (let i = 15; i >= 0 && carry > 0; i--) {
      const sum = counter[i] + carry;
      counter[i] = sum & 0xff;
      carry = sum >>> 8;
    }

    return counter;
  }

  /**
   * Apply AES-CTR keystream to data in-place (XOR operation)
   * @param data Data to XOR with keystream
   */
  async apply_keystream(data: Bytes): Promise<void> {
    const start = this.bytePosition;
    const end = start + BigInt(data.length);

    // Update bytePosition before awaiting to prevent concurrent calls from reading the same position
    this.bytePosition = end;

    const keystream = await this.getKeystream(start, end);

    for (let i = 0; i < data.length; i++) {
      data[i] ^= keystream[i];
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

  /**
   * Reset byte position to zero (for testing only)
   */
  resetPosition(): void {
    this.bytePosition = 0n;
  }
}
