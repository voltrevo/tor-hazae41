import { Bytes } from '../../../../bytes';
import { fromNativeOrBuffer } from '../buffer/index';

const adapter = fromNativeOrBuffer();

export interface Adapter {
  encodeOrThrow(bytes: Bytes): string;

  decodeOrThrow(text: string): Bytes;

  padStartAndDecodeOrThrow(text: string): Bytes;

  padEndAndDecodeOrThrow(text: string): Bytes;
}

export function encodeOrThrow(bytes: Bytes): string {
  return adapter.encodeOrThrow(bytes);
}

export function decodeOrThrow(text: string): Bytes {
  return adapter.decodeOrThrow(text);
}

export function padStartAndDecodeOrThrow(text: string): Bytes {
  return adapter.padStartAndDecodeOrThrow(text);
}

export function padEndAndDecodeOrThrow(text: string): Bytes {
  return adapter.padEndAndDecodeOrThrow(text);
}
