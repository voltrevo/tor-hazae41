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
      return Buffers.fromView(bytes).toString('base64');
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64'));
    },

    encodeUnpaddedOrThrow(bytes: Uint8Array) {
      return Buffers.fromView(bytes).toString('base64').replaceAll('=', '');
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64'));
    },
  } satisfies Adapter;
}
