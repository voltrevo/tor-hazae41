import { DER, DERCursor } from '../../../asn1';
import { Readable } from '../../../binary/mod';
import { Bytes } from '../../../bytes';
import { Resolvable } from './resolve';

export function readAndResolveFromBytesOrThrow<T>(
  resolvable: Resolvable<T>,
  bytes: Bytes
): T {
  const triplet = Readable.readFromBytesOrThrow(DER, bytes);
  const cursor = new DERCursor([triplet]);

  return resolvable.resolveOrThrow(cursor);
}
