import { ArrayLike } from '../../../arrays/index';
import { Ascii } from '../../libs/ascii/ascii';
import { Buffers } from '../../libs/buffers/index';
import { Utf8 } from '../../libs/utf8/utf8';

export type Uint8Array<N extends number = number> = number extends N
  ? globalThis.Uint8Array
  : globalThis.Uint8Array & { readonly length: N };

export namespace Bytes {
  /**
   * Alloc 0-lengthed bytes using standard constructor
   * @returns `Uint8Array<[]>`
   */
  export function empty(): Uint8Array<0> {
    return alloc(0);
  }

  /**
   * Alloc bytes with typed length using standard constructor
   * @param length
   * @returns `Uint8Array[0;N]`
   */
  export function alloc<N extends number>(length: N): Uint8Array<N> {
    return new Uint8Array(length) as Uint8Array<N>;
  }

  /**
   * Create bytes from array
   * @param array
   * @returns `Uint8Array[number;N]`
   */
  export function from<N extends number>(
    sized: ArrayLike<number, N>
  ): Uint8Array<N>;

  export function from(array: ArrayBuffer | ArrayLike<number>): Uint8Array;

  export function from(array: ArrayBuffer | ArrayLike<number>): Uint8Array {
    return new Uint8Array(array);
  }

  /**
   * Alloc Uint8Array with typed length and fill it with WebCrypto's CSPRNG
   * @param length
   * @returns `Uint8Array[number;N]`
   */
  export function random<N extends number>(length: N): Uint8Array<N> {
    const bytes = alloc(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Type guard bytes of N length into Uint8Array<N>
   * @param bytes
   * @param length
   * @returns
   */
  export function is<N extends number>(
    bytes: Uint8Array,
    length: N
  ): bytes is Uint8Array<N> {
    return bytes.length.valueOf() === length.valueOf();
  }

  /**
   * Equality check (using indexedDB.cmp on browsers, Buffer.equals on Node)
   * @param a
   * @param b
   * @returns
   */
  export function equals<N extends number>(
    a: Uint8Array,
    b: Uint8Array<N>
  ): a is Uint8Array<N> {
    if ('indexedDB' in globalThis) return indexedDB.cmp(a, b) === 0;
    if ('process' in globalThis) return Buffers.fromView(a).equals(b);
    throw new Error(`Could not compare bytes`);
  }

  /**
   * Equality check (using indexedDB.cmp on browsers, Buffer.equals on Node)
   * @param a
   * @param b
   * @returns
   */
  export function equals2<N extends number>(
    a: Uint8Array<N>,
    b: Uint8Array
  ): b is Uint8Array<N> {
    return equals(b, a);
  }

  /**
   * Try to cast bytes of N length into Uint8Array<N>
   * @param view
   * @param length
   * @returns
   */
  export function asOrThrow<N extends number>(
    bytes: Uint8Array,
    length: N
  ): Uint8Array<N> {
    if (!is(bytes, length)) throw new Error();
    return bytes;
  }

  /**
   * Zero-copy conversion from ArrayBufferView into Uint8Array
   * @param view
   * @returns
   */
  export function fromView(view: ArrayBufferView): Uint8Array {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  /**
   * Utf8 encoding using TextEncoder
   * @param text
   * @returns
   */
  export function fromUtf8(text: string): Uint8Array {
    return Utf8.encoder.encode(text);
  }

  /**
   * Utf8 decoding using TextDecoder
   * @param text
   * @returns
   */
  export function toUtf8(bytes: Uint8Array): string {
    return Utf8.decoder.decode(bytes);
  }

  /**
   * Ascii decoding (using Buffer.from on Node, TextEncoder on others)
   * @param bytes
   * @returns
   */
  export function fromAscii(text: string): Uint8Array {
    if ('process' in globalThis) return fromView(Buffer.from(text, 'ascii'));
    return Ascii.encoder.encode(text);
  }

  /**
   * Ascii encoding (using Buffer.toString on Node, TextDecoder on others)
   * @param bytes
   * @returns
   */
  export function toAscii(bytes: Uint8Array): string {
    if ('process' in globalThis)
      return Buffers.fromView(bytes).toString('ascii');
    return Ascii.decoder.decode(bytes);
  }

  /**
   * Slice or pad bytes to exact length by filling 0s at the start
   * @example sliceOrPadStart([1,2,3,4], 2) = [3,4]
   * @example sliceOrPadStart([1,2,3,4], 6) = [0,0,1,2,3,4]
   * @param bytes
   * @param length
   * @returns
   */
  export function sliceOrPadStart<N extends number>(
    bytes: Uint8Array,
    length: N
  ): Uint8Array<N> {
    if (bytes.length >= length) {
      const slice = bytes.slice(bytes.length - length, bytes.length);
      return fromView(slice) as Uint8Array<N>;
    }

    const array = alloc(length);
    array.set(bytes, length - bytes.length);
    return array;
  }

  /**
   * Pad bytes to minimum length by filling 0s at the start
   * @example padStart([1,2,3,4], 2) = [1,2,3,4]
   * @example padStart([1,2,3,4], 6) = [0,0,1,2,3,4]
   * @param bytes
   * @param length
   * @returns
   */
  export function padStart<X extends number, N extends number>(
    bytes: Uint8Array<X>,
    length: N
  ): Uint8Array<X> | Uint8Array<N> {
    if (bytes.length >= length) return bytes;

    const array = alloc(length);
    array.set(bytes, length - bytes.length);
    return array;
  }

  /**
   * Concatenation (using Buffer.concat on Node, home-made on others)
   * @param list
   * @returns
   */
  export function concat(list: Uint8Array[]) {
    if ('process' in globalThis) return fromView(Buffer.concat(list));

    const length = list.reduce((p, c) => p + c.length, 0);
    const result = alloc(length);

    let offset = 0;

    for (const bytes of list) {
      result.set(bytes, offset);
      offset += bytes.length;
    }

    return result;
  }

  /**
   * Search bytes in bytes
   * @param bytes
   * @param search
   * @param start
   * @returns index or -1
   */
  export function indexOf(
    bytes: Uint8Array,
    search: Uint8Array,
    start = 0
  ): number {
    while (true) {
      const index = bytes.indexOf(search[0], start);

      if (index === -1) return -1;

      if (equals(bytes.subarray(index, index + search.length), search))
        return index;

      start = index + 1;
    }
  }
}
