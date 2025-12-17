import { DERable } from '../../../asn1/index';
import { Writable } from '../../../binary/mod';
import { Bytes } from '../../../bytes';

export function writeToBytesOrThrow(type: DERable): Bytes {
  return Writable.writeToBytesOrThrow(type.toDER());
}
