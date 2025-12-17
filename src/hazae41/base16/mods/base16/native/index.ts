import { Bytes } from '../../../../bytes';
import { Adapter } from '../adapter/index';

export function fromNative() {
  function encodeOrThrow(bytes: Bytes) {
    return Bytes.toHex(bytes);
  }

  function decodeOrThrow(text: string) {
    return Bytes.fromHex(text);
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
