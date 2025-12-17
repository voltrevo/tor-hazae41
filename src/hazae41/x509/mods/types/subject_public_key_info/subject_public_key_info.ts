import {
  BitString,
  DER,
  DERCursor,
  DERTriplet,
  Sequence,
} from '../../../../asn1/index';
import { Readable } from '../../../../binary/mod';
import { Unimplemented } from '../../errors';
import { RsaPublicKey } from '../../keys/rsa/public';
import { AlgorithmIdentifier } from '../algorithm_identifier/algorithm_identifier';

export type SubjectPublicKey = RsaPublicKey;

export class SubjectPublicKeyInfo {
  constructor(
    readonly algorithm: AlgorithmIdentifier,
    readonly subjectPublicKey: BitString.DER
  ) {}

  toDER(): DERTriplet {
    return Sequence.create(undefined, [
      this.algorithm.toDER(),
      this.subjectPublicKey,
    ] as const).toDER();
  }

  readPublicKeyOrThrow() {
    const triplet = Readable.readFromBytesOrThrow(
      DER,
      this.subjectPublicKey.bytes
    );

    if (this.algorithm.algorithm.value === RsaPublicKey.oid)
      return RsaPublicKey.resolveOrThrow(new DERCursor([triplet]));

    throw new Unimplemented();
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER);
    const algorithm = AlgorithmIdentifier.resolveOrThrow(cursor);
    const subjectPublicKey = cursor.readAsOrThrow(BitString.DER);

    return new SubjectPublicKeyInfo(algorithm, subjectPublicKey);
  }
}
