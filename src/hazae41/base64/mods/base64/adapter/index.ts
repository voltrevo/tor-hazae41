import { fromNativeOrBuffer } from '../buffer/index';

const adapter: Adapter = fromNativeOrBuffer();

export interface Adapter {
  encodePaddedOrThrow(bytes: Uint8Array): string;

  decodePaddedOrThrow(text: string): Uint8Array<ArrayBuffer>;

  encodeUnpaddedOrThrow(bytes: Uint8Array): string;

  decodeUnpaddedOrThrow(text: string): Uint8Array<ArrayBuffer>;
}

export function encodePaddedOrThrow(bytes: Uint8Array): string {
  return adapter.encodePaddedOrThrow(bytes);
}

export function decodePaddedOrThrow(text: string): Uint8Array<ArrayBuffer> {
  return adapter.decodePaddedOrThrow(text);
}

export function encodeUnpaddedOrThrow(bytes: Uint8Array): string {
  return adapter.encodeUnpaddedOrThrow(bytes);
}

export function decodeUnpaddedOrThrow(text: string): Uint8Array<ArrayBuffer> {
  return adapter.decodeUnpaddedOrThrow(text);
}
