import { DERCursor, DERTriplet } from '../../../../asn1/index';
import { RDNSequence } from '../rdn_sequence/rdn_sequence';

export class Name {
  constructor(readonly inner: RDNSequence) {}

  toDER(): DERTriplet {
    return this.inner.toDER();
  }

  toX501OrThrow() {
    return this.inner.toX501OrThrow();
  }

  static fromX501OrThrow(x501: string) {
    return new Name(RDNSequence.fromX501OrThrow(x501));
  }

  static resolveOrThrow(cursor: DERCursor) {
    return new Name(RDNSequence.resolveOrThrow(cursor));
  }
}
