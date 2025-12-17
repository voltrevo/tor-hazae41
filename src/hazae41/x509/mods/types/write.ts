import { DERable } from '../../../asn1/index';
import { Writable } from '../../../binary/mod';

export function writeToBytesOrThrow(type: DERable): Uint8Array<ArrayBuffer> {
  return Writable.writeToBytesOrThrow(type.toDER());
}
