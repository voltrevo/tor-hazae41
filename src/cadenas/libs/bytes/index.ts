import { Cursor } from '../../../hazae41/cursor/mod';

export namespace Bytes {
  /**
   * Wraps TextEncoder.encode() to return Uint8Array<ArrayBuffer>.
   * Safe cast: TextEncoder always creates ArrayBuffer-backed Uint8Array,
   * but lib.dom.d.ts types it as ArrayBufferLike for compatibility with SharedArrayBuffer contexts.
   * We use ArrayBuffer since we control the creation and never use SharedArrayBuffer.
   */
  export function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
    const encoded = new TextEncoder().encode(text);
    return encoded as Uint8Array<ArrayBuffer>;
  }

  export function equals(a: Uint8Array, b: Uint8Array): boolean {
    if ('indexedDB' in globalThis) return indexedDB.cmp(a, b) === 0;
    if ('process' in globalThis) {
      // Node.js: manual byte comparison
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }
    throw new Error(`Could not compare bytes`);
  }

  export function concat(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const length = arrays.reduce((a, b) => a + b.length, 0);
    const newBuffer = new Uint8Array(length);
    const cursor = new Cursor(newBuffer);

    for (const array of arrays) cursor.writeOrThrow(array);

    return cursor.bytes;
  }
}
