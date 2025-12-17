import { Bytes } from '../../../../bytes';
import { Buffers } from '../../../libs/buffers/buffers';
import { Adapter } from '../adapter/index';
import { fromNative } from '../native/index';

export function fromNativeOrBuffer() {
  if ('fromHex' in Bytes) return fromNative();
  return fromBuffer();
}

export function fromBuffer() {
  function encodeOrThrow(bytes: Bytes) {
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
