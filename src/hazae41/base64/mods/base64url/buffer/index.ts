import { Buffers } from '../../../libs/buffers/buffers';
import { Bytes } from '../../../libs/bytes/bytes';
import { Adapter } from '../adapter/index';
import { fromNative } from '../native/index';

export function fromNativeOrBuffer() {
  if ('fromBase64' in Uint8Array) return fromNative();
  return fromBuffer();
}

export function fromBuffer() {
  return {
    encodePaddedOrThrow(bytes: Uint8Array) {
      const unpadded = Buffers.fromView(bytes).toString('base64url');
      const repadded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);

      return repadded;
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64url'));
    },

    encodeUnpaddedOrThrow(bytes: Uint8Array) {
      return Buffers.fromView(bytes).toString('base64url');
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64url'));
    },
  } satisfies Adapter;
}
