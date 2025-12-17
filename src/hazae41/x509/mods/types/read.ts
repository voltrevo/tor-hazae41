import { DER, DERCursor } from '../../../asn1/index';
import { Readable } from '../../../binary/mod';
import { Resolvable } from './resolve';

export function readAndResolveFromBytesOrThrow<T>(
  resolvable: Resolvable<T>,
  bytes: Uint8Array
): T {
  const triplet = Readable.readFromBytesOrThrow(DER, bytes);
  const cursor = new DERCursor([triplet]);

  return resolvable.resolveOrThrow(cursor);
}
