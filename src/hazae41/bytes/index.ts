import { assert } from '../../utils/assert';
import { Ascii } from '../common/Ascii';

type ArrayLike<T, N extends number = number> = number extends N
  ? globalThis.ArrayLike<T>
  : globalThis.ArrayLike<T> & { readonly length: N };

export type Bytes<N extends number = number> =
  globalThis.Uint8Array<ArrayBuffer> & {
    length: N;
  };

if (
  typeof crypto === 'undefined' ||
  typeof crypto.getRandomValues !== 'function'
) {
  throw new Error(
    'crypto.getRandomValues is not available. ' +
      'tor-js requires a secure random number generator (CSPRNG). ' +
      'Ensure you are running in a modern browser or Node.js 15+ environment.'
  );
}

export namespace Bytes {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  /**
   * Alloc 0-lengthed bytes using standard constructor
   * @returns `Bytes<[]>`
   */
  export function empty(): Bytes<0> {
    return alloc(0);
  }

  /**
   * Alloc bytes with typed length using standard constructor
   * @param length
   * @returns `Bytes[0;N]`
   */
  export function alloc<N extends number>(length: N): Bytes<N> {
    return new Uint8Array(length) as Bytes<N>;
  }

  /**
   * Create bytes from array
   * @param array
   * @returns `Bytes[number;N]`
   */
  export function from<N extends number>(sized: ArrayLike<number, N>): Bytes<N>;

  export function from(array: ArrayBuffer | ArrayLike<number>): Bytes;

  export function from(array: ArrayBuffer | ArrayLike<number>): Bytes {
    return new Uint8Array(array);
  }

  /**
   * Alloc Bytes with typed length and fill it with WebCrypto's CSPRNG
   * @param length
   * @returns `Bytes[number;N]`
   */
  export function random<N extends number>(length: N): Bytes<N> {
    const bytes = alloc(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Securely zero out sensitive byte data.
   * Overwrites the buffer with zeros to prevent sensitive data from lingering in memory.
   * @param bytes The bytes to zeroize
   */
  export function zeroize(bytes: Bytes): void {
    bytes.fill(0);
  }

  /**
   * Type guard bytes of N length into Bytes<N>
   * @param bytes
   * @param length
   * @returns
   */
  export function is<N extends number>(
    bytes: Bytes,
    length: N
  ): bytes is Bytes<N> {
    return bytes.length.valueOf() === length.valueOf();
  }

  /**
   * Equality check
   * @param a
   * @param b
   * @returns
   */
  export function equals<N extends number>(
    a: Bytes,
    b: Bytes<N>
  ): a is Bytes<N> {
    if (a.length !== b.length) {
      return false;
    }

    const len = a.length;

    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Equality check
   * @param a
   * @param b
   * @returns
   */
  export function equals2<N extends number>(
    a: Bytes<N>,
    b: Bytes
  ): b is Bytes<N> {
    return equals(b, a);
  }

  /**
   * Try to cast bytes of N length into Bytes<N>
   * @param view
   * @param length
   * @returns
   */
  export function asOrThrow<N extends number>(
    bytes: Bytes,
    length: N
  ): Bytes<N> {
    if (!is(bytes, length)) throw new Error();
    return bytes;
  }

  /**
   * Zero-copy conversion from ArrayBufferView into Bytes
   * @param view
   * @returns
   */
  export function fromView(view: ArrayBufferView<ArrayBuffer>): Bytes {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  /**
   * Utf8 encoding using TextEncoder
   * @param text
   * @returns
   */
  export function encodeUtf8(text: string): Bytes {
    return encoder.encode(text) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Utf8 decoding using TextDecoder
   * @param text
   * @returns
   */
  export function decodeUtf8(bytes: Bytes): string {
    return decoder.decode(bytes);
  }

  /**
   * Ascii decoding
   * @param bytes
   * @returns
   */
  export function fromAscii(text: string): Bytes {
    return Ascii.encoder.encode(text) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Ascii encoding
   * @param bytes
   * @returns
   */
  export function toAscii(bytes: Bytes): string {
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
    bytes: Bytes,
    length: N
  ): Bytes<N> {
    if (bytes.length >= length) {
      const slice = bytes.slice(bytes.length - length, bytes.length);
      return fromView(slice) as Bytes<N>;
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
    bytes: Bytes<X>,
    length: N
  ): Bytes<X> | Bytes<N> {
    if (bytes.length >= length) return bytes;

    const array = alloc(length);
    array.set(bytes, length - bytes.length);
    return array;
  }

  /**
   * Concatenation
   * @param list
   * @returns
   */
  export function concat(...list: Bytes[]) {
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
  export function indexOf(bytes: Bytes, search: Bytes, start = 0): number {
    while (true) {
      const index = bytes.indexOf(search[0], start);

      if (index === -1) return -1;

      if (equals(bytes.subarray(index, index + search.length), search))
        return index;

      start = index + 1;
    }
  }

  export function assertLen<N extends number>(
    bytes: Bytes,
    len: N
  ): asserts bytes is Bytes<N> {
    assert(bytes.length === len);
  }

  /**
   * Hex encoding
   * @param bytes
   * @returns hex string
   */
  export function toHex(bytes: Bytes): string {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * Hex decoding
   * @param hex hex string
   * @returns bytes
   */
  export function fromHex(hex: string): Bytes {
    if (hex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    const bytes = alloc(hex.length / 2) as Bytes;
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substring(i, i + 2), 16);
      if (isNaN(byte)) {
        throw new Error(`Invalid hex character at position ${i}`);
      }
      bytes[i / 2] = byte;
    }
    return bytes;
  }

  export function fromHexAllowMissing0(hex: string): Bytes {
    if (hex.length % 2 === 1) {
      // TODO: does this ever happen?
      return fromHex('0' + hex);
    }

    return fromHex(hex);
  }

  export interface Base64Options {
    alphabet?: 'base64' | 'base64url';
    omitPadding?: boolean;
  }

  /**
   * Base64 encoding
   * @param bytes
   * @param options encoding options
   * @returns base64 string
   */
  export function toBase64(bytes: Bytes, options?: Base64Options): string {
    // Browser implementation
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    let encoded = btoa(binary);

    if (options?.alphabet === 'base64url') {
      encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_');
    }
    if (options?.omitPadding) {
      encoded = encoded.replace(/=/g, '');
    }
    return encoded;
  }

  /**
   * Base64 decoding
   * @param text base64 string
   * @param options decoding options
   * @returns bytes
   */
  export function fromBase64(text: string, options?: Base64Options): Bytes {
    let normalized = text;
    if (options?.alphabet === 'base64url') {
      normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
    }
    // Add padding if needed
    const paddingLength = (4 - (normalized.length % 4)) % 4;
    normalized = normalized + '='.repeat(paddingLength);

    try {
      const binary = atob(normalized);
      const bytes = alloc(binary.length) as Bytes;
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      throw new Error('Invalid base64 string');
    }
  }
}
