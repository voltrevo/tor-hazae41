import { DERable } from '../../../asn1/index.ts';
import { Writable } from '../../../binary/mod.ts';

export function writeToBytesOrThrow(type: DERable): Uint8Array<ArrayBuffer> {
  return Writable.writeToBytesOrThrow(type.toDER());
}
