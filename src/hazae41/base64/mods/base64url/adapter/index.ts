import { Bytes } from '../../../../bytes';
import { fromNativeOrBuffer } from '../buffer/index';

const adapter: Adapter = fromNativeOrBuffer();

export interface Adapter {
  encodePaddedOrThrow(bytes: Bytes): string;

  decodePaddedOrThrow(text: string): Bytes;

  encodeUnpaddedOrThrow(bytes: Bytes): string;

  decodeUnpaddedOrThrow(text: string): Bytes;
}

export function encodePaddedOrThrow(bytes: Bytes): string {
  return adapter.encodePaddedOrThrow(bytes);
}

export function decodePaddedOrThrow(text: string): Bytes {
  return adapter.decodePaddedOrThrow(text);
}

export function encodeUnpaddedOrThrow(bytes: Bytes): string {
  return adapter.encodeUnpaddedOrThrow(bytes);
}

export function decodeUnpaddedOrThrow(text: string): Bytes {
  return adapter.decodeUnpaddedOrThrow(text);
}
