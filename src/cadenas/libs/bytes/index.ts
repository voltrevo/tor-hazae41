import { Cursor } from '@hazae41/cursor';
import { Buffers } from '../../libs/buffers/index.js';

export namespace Bytes {
  export function equals(a: Uint8Array, b: Uint8Array): boolean {
    if ('indexedDB' in globalThis) return indexedDB.cmp(a, b) === 0;
    if ('process' in globalThis) return Buffers.fromView(a).equals(b);
    throw new Error(`Could not compare bytes`);
  }

  export function concat(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const length = arrays.reduce((a, b) => a + b.length, 0);
    const result = new Cursor(new Uint8Array(length));

    for (const array of arrays) result.writeOrThrow(array);

    return result.bytes;
  }
}
