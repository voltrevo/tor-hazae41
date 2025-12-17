import { Bytes } from '../../../../bytes';
import { Adapter } from '../adapter/index';

export function fromNative() {
  return {
    encodePaddedOrThrow(bytes: Bytes) {
      return Bytes.toBase64(bytes);
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromBase64(text);
    },

    encodeUnpaddedOrThrow(bytes: Bytes) {
      return Bytes.toBase64(bytes, { omitPadding: true });
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromBase64(text);
    },
  } satisfies Adapter;
}
