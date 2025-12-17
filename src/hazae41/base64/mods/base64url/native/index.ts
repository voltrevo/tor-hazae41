import { Bytes } from '../../../../bytes';
import { Adapter } from '../adapter/index';

export function fromNative() {
  return {
    encodePaddedOrThrow(bytes: Bytes) {
      return bytes.toBase64({ alphabet: 'base64url' });
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromBase64(text, { alphabet: 'base64url' });
    },

    encodeUnpaddedOrThrow(bytes: Bytes) {
      return bytes.toBase64({ alphabet: 'base64url', omitPadding: true });
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromBase64(text, { alphabet: 'base64url' });
    },
  } satisfies Adapter;
}
