import { Base16 } from '../../../base16';
import { Bytes } from '../../../bytes';

export namespace BigBytes {
  export function exportOrThrow(value: bigint) {
    return Base16.padStartAndDecodeOrThrow(value.toString(16));
  }

  export function importOrThrow(bytes: Bytes) {
    return BigInt('0x' + Base16.encodeOrThrow(bytes));
  }
}
