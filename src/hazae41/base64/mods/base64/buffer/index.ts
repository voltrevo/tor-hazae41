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
      return Buffers.fromView(bytes).toString('base64');
    },

    decodePaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64'));
    },

    encodeUnpaddedOrThrow(bytes: Bytes) {
      return Buffers.fromView(bytes).toString('base64').replaceAll('=', '');
    },

    decodeUnpaddedOrThrow(text: string) {
      return Bytes.fromView(Buffer.from(text, 'base64'));
    },
  } satisfies Adapter;
}
