import { fromNativeOrBuffer } from "../buffer/index"

const adapter = fromNativeOrBuffer()

export interface Adapter {
  encodeOrThrow(bytes: Uint8Array): string

  decodeOrThrow(text: string): Uint8Array<ArrayBuffer>

  padStartAndDecodeOrThrow(text: string): Uint8Array<ArrayBuffer>

  padEndAndDecodeOrThrow(text: string): Uint8Array<ArrayBuffer>
}

export function encodeOrThrow(bytes: Uint8Array): string {
  return adapter.encodeOrThrow(bytes)
}

export function decodeOrThrow(text: string): Uint8Array<ArrayBuffer> {
  return adapter.decodeOrThrow(text)
}

export function padStartAndDecodeOrThrow(text: string): Uint8Array<ArrayBuffer> {
  return adapter.padStartAndDecodeOrThrow(text)
}

export function padEndAndDecodeOrThrow(text: string): Uint8Array<ArrayBuffer> {
  return adapter.padEndAndDecodeOrThrow(text)
}