import { Adapter } from "../adapter/index"

declare global {
  interface Uint8Array {
    toBase64(options?: unknown): string
  }

  interface Uint8ArrayConstructor {
    fromBase64(base64: string, options?: unknown): Uint8Array<ArrayBuffer>
  }
}

export function fromNative() {
  return {
    encodePaddedOrThrow(bytes: Uint8Array) {
      return bytes.toBase64()
    },

    decodePaddedOrThrow(text: string) {
      return Uint8Array.fromBase64(text)
    },

    encodeUnpaddedOrThrow(bytes: Uint8Array) {
      return bytes.toBase64({ omitPadding: true })
    },

    decodeUnpaddedOrThrow(text: string) {
      return Uint8Array.fromBase64(text)
    }
  } satisfies Adapter
}