/**
 * Synchronous AES-128 in CTR mode wrapper for @hazae41/aes.wasm.
 *
 * This wraps the original Aes128Ctr128BEKey to accept Uint8Array
 * while internally using Memory objects as required by the WASM implementation.
 */

import { Aes128Ctr128BEKey, AesWasm } from '@hazae41/aes.wasm';

/**
 * Synchronous AES-128-CTR key wrapper for hazae WASM implementation
 */
export class HazaeWasmAes128Ctr {
  private key: Aes128Ctr128BEKey;
  private keyMemory: AesWasm.Memory;
  private ivMemory: AesWasm.Memory;

  /**
   * Create a new AES-128-CTR key using hazae WASM implementation
   * @param keyBytes 16-byte AES key
   * @param counterBytes 16-byte initial counter value
   */
  constructor(keyBytes: Uint8Array, counterBytes: Uint8Array) {
    if (keyBytes.length !== 16) {
      throw new Error('Key must be 16 bytes for AES-128');
    }
    if (counterBytes.length !== 16) {
      throw new Error('Counter must be 16 bytes');
    }

    // Create Memory objects for the key and counter
    this.keyMemory = new AesWasm.Memory(keyBytes);
    this.ivMemory = new AesWasm.Memory(counterBytes);

    // Create the key using hazae WASM
    this.key = new Aes128Ctr128BEKey(this.keyMemory, this.ivMemory);
  }

  /**
   * Apply AES-CTR keystream to data in-place (XOR operation)
   * This is a synchronous wrapper around the original apply_keystream method
   *
   * @param data Data to XOR with keystream
   */
  apply_keystream(data: Uint8Array): void {
    // Create a temporary Memory object for the data
    using memory = new AesWasm.Memory(data);

    // Apply the keystream
    this.key.apply_keystream(memory);

    // Copy the result back to the original array
    data.set(memory.bytes);
  }

  /**
   * Resource cleanup (for 'using' statements)
   */
  [Symbol.dispose](): void {
    this.key[Symbol.dispose]();
    this.keyMemory[Symbol.dispose]();
    this.ivMemory[Symbol.dispose]();
  }

  /**
   * Async resource cleanup (for async context managers)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    // asyncDispose may not exist on all objects, so check before calling
    const keyDispose = (
      this.key as { [Symbol.asyncDispose]?: () => Promise<void> }
    )[Symbol.asyncDispose];
    if (typeof keyDispose === 'function') {
      await keyDispose.call(this.key);
    }
    const keyMemoryDispose = (
      this.keyMemory as { [Symbol.asyncDispose]?: () => Promise<void> }
    )[Symbol.asyncDispose];
    if (typeof keyMemoryDispose === 'function') {
      await keyMemoryDispose.call(this.keyMemory);
    }
    const ivMemoryDispose = (
      this.ivMemory as { [Symbol.asyncDispose]?: () => Promise<void> }
    )[Symbol.asyncDispose];
    if (typeof ivMemoryDispose === 'function') {
      await ivMemoryDispose.call(this.ivMemory);
    }
  }
}
