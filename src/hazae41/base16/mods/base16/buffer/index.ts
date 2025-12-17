import { Buffers } from '../../../libs/buffers/buffers.ts';
import { Bytes } from '../../../libs/bytes/bytes.ts';
import { Adapter } from '../adapter/index';
import { fromNative } from '../native/index';

export function fromNativeOrBuffer() {
  if ('fromHex' in Uint8Array) return fromNative();
  return fromBuffer();
}

export function fromBuffer() {
  function encodeOrThrow(bytes: Uint8Array) {
    return Buffers.fromView(bytes).toString('hex');
  }

  function decodeOrThrow(text: string) {
    return Bytes.fromView(Buffer.from(text, 'hex'));
  }

  function padStartAndDecodeOrThrow(text: string) {
    return decodeOrThrow(text.length % 2 ? '0' + text : text);
  }

  function padEndAndDecodeOrThrow(text: string) {
    return decodeOrThrow(text.length % 2 ? text + '0' : text);
  }

  return {
    encodeOrThrow,
    decodeOrThrow,
    padStartAndDecodeOrThrow,
    padEndAndDecodeOrThrow,
  } satisfies Adapter;
}
