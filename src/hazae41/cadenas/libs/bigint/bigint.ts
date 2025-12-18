import { Bytes } from '../../../bytes';

export namespace BigBytes {
  export function exportOrThrow(value: bigint) {
    return Bytes.fromHexAllowMissing0(value.toString(16));
  }

  export function importOrThrow(bytes: Bytes) {
    return BigInt('0x' + Bytes.toHex(bytes));
  }
}
