import { Bytes } from '../../../../bytes';
import { Buffers } from '../../../libs/buffers/buffers';
import { Adapter } from '../adapter/index';
import { fromNative } from '../native/index';

export function fromNativeOrBuffer() {
  if ('fromBase64' in Bytes) return fromNative();
  return fromBuffer();
}

export function fromBuffer() {
  return {
    encodePaddedOrThrow(bytes: Bytes) {
      const unpadded = Buffers.fromView(bytes).toString('base64url');
      const repadded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);

      return repadded;
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64url'));
    },

    encodeUnpaddedOrThrow(bytes: Bytes) {
      return Buffers.fromView(bytes).toString('base64url');
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64url'));
    },
  } satisfies Adapter;
}
