import { Bytes } from '../../../bytes';

export function encodeOrThrow(bytes: Bytes) {
  return Bytes.toHex(bytes);
}

export function decodeOrThrow(text: string) {
  return Bytes.fromView(Buffer.from(text, 'hex'));
}

export function padStartAndDecodeOrThrow(text: string) {
  return decodeOrThrow(text.length % 2 ? '0' + text : text);
}

export function padEndAndDecodeOrThrow(text: string) {
  return decodeOrThrow(text.length % 2 ? text + '0' : text);
}
