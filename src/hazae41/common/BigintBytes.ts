import { Bytes } from '../bytes';

export namespace BigintBytes {
  export function toBytes(value: bigint) {
    return Bytes.fromHexAllowMissing0(value.toString(16));
  }

  export function fromBytes(bytes: Bytes) {
    return BigInt('0x' + Bytes.toHex(bytes));
  }
}
