import { Adapter } from '../adapter/index';

declare global {
  interface Uint8Array {
    toBase64(options?: unknown): string;
  }

  interface Uint8ArrayConstructor {
    fromBase64(base64: string, options?: unknown): Uint8Array<ArrayBuffer>;
  }
}

export function fromNative() {
  return {
    encodePaddedOrThrow(bytes: Uint8Array) {
      return bytes.toBase64({ alphabet: 'base64url' });
    },

    decodePaddedOrThrow(text: string) {
      return Uint8Array.fromBase64(text, { alphabet: 'base64url' });
    },

    encodeUnpaddedOrThrow(bytes: Uint8Array) {
      return bytes.toBase64({ alphabet: 'base64url', omitPadding: true });
    },

    decodeUnpaddedOrThrow(text: string) {
      return Uint8Array.fromBase64(text, { alphabet: 'base64url' });
    },
  } satisfies Adapter;
}
