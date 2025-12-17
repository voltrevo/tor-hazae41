import { Buffers } from '../buffers/index.ts';

export namespace Bytes {
  export function equals(a: Uint8Array, b: Uint8Array): boolean {
    if ('indexedDB' in globalThis) return indexedDB.cmp(a, b) === 0;
    if ('process' in globalThis) return Buffers.fromView(a).equals(b);
    throw new Error(`Could not compare bytes`);
  }
}
