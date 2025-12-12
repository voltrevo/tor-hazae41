/**
 * WebCrypto-based AES-128 in CTR mode with big-endian counter.
 * This is a drop-in replacement for @hazae41/aes.wasm's Aes128Ctr128BEKey.
 *
 * Key differences from the WASM implementation:
 * - apply_keystream() is now async
 * - Counter is tracked internally and auto-incremented
 * - No external WASM dependency
 */

/**
 * Stateful AES-128-CTR key with auto-incrementing counter
 */
export class WebCryptoAes128Ctr {
  private cryptoKey: CryptoKey | null = null;
  private counter: Uint8Array;
  private initialized = false;

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

    // Store key bytes for lazy initialization
    this._keyBytes = new Uint8Array(keyBytes);
  }

  private _keyBytes: Uint8Array;

  /**
   * Lazy initialization of CryptoKey (must happen before first use)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    this.cryptoKey = await crypto.subtle.importKey(
      'raw',
      this._keyBytes,
      { name: 'AES-CTR' },
      false,
      ['encrypt']
    );

    this.initialized = true;
  }

  /**
   * Apply AES-CTR keystream to data in-place (XOR operation)
   * Automatically increments counter by the number of blocks processed
   *
   * @param data Data to XOR with keystream
   */
  async apply_keystream(data: Uint8Array): Promise<void> {
    await this.ensureInitialized();

    if (!this.cryptoKey) {
      throw new Error('CryptoKey initialization failed');
    }

    // Calculate number of 16-byte blocks needed
    const blockCount = Math.ceil(data.length / 16);

    // Create a copy of counter for encryption (don't modify yet)
    const counterCopy = new Uint8Array(this.counter);

    // Generate keystream by encrypting zeros
    const zeros = new Uint8Array(blockCount * 16);
    const keystream = await crypto.subtle.encrypt(
      {
        name: 'AES-CTR',
        counter: counterCopy,
        length: 128, // counter length in bits
      },
      this.cryptoKey,
      zeros
    );

    // XOR keystream with data
    const keystreamArray = new Uint8Array(keystream);
    for (let i = 0; i < data.length; i++) {
      data[i] ^= keystreamArray[i];
    }

    // Increment counter by number of blocks processed
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
    // No WASM resources to clean up, but keep interface compatible
  }

  /**
   * Async resource cleanup (for async context managers)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    // No cleanup needed
  }
}
