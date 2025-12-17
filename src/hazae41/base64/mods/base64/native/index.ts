import { Bytes } from '../../../../bytes';
import { Adapter } from '../adapter/index';

export function fromNative() {
  return {
    encodePaddedOrThrow(bytes: Bytes) {
      return bytes.toBase64();
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromBase64(text);
    },

    encodeUnpaddedOrThrow(bytes: Bytes) {
      return bytes.toBase64({ omitPadding: true });
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromBase64(text);
    },
  } satisfies Adapter;
}
