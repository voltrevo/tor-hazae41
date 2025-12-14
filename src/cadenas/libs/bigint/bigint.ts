import { Base16 } from '@hazae41/base16';

export namespace BigBytes {
  export function exportOrThrow(value: bigint) {
    return Base16.padStartAndDecodeOrThrow(value.toString(16));
  }

  export function importOrThrow(bytes: Uint8Array) {
    return BigInt('0x' + Base16.encodeOrThrow(bytes));
  }
}
