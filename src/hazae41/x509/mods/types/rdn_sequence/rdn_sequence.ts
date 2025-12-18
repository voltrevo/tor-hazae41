import { DERCursor, DERTriplet, Sequence } from '../../../../asn1';
import { RelativeDistinguishedName } from '../relative_distinguished_name/relative_distinguished_name';

const UNESCAPED_COMMA_REGEX = /[^\\],/g;

export class RDNSequence {
  constructor(readonly triplets: RelativeDistinguishedName[]) {}

  toDER(): DERTriplet {
    return Sequence.create(
      undefined,
      this.triplets.map(it => it.toDER())
    ).toDER();
  }

  toX501OrThrow() {
    return this.triplets
      .map(it => it.toX501OrThrow())
      .reverse()
      .join(',');
  }

  static fromX501OrThrow(x501: string) {
    const triplets = x501
      .replaceAll(UNESCAPED_COMMA_REGEX, ([c]) => `${c},,`)
      .split(',,')
      .reverse()
      .map(it => RelativeDistinguishedName.fromX501OrThrow(it));

    return new RDNSequence(triplets);
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER);

    const triplets = new Array<RelativeDistinguishedName>(
      cursor.triplets.length
    );

    for (let i = 0; i < triplets.length; i++)
      triplets[i] = RelativeDistinguishedName.resolveOrThrow(cursor);

    return new RDNSequence(triplets);
  }
}
