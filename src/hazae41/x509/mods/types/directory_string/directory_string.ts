import {
  DERCursor,
  PrintableString,
  TeletexString,
  UTF8String,
} from '../../../../asn1/index.ts';
import { Unimplemented } from '../../errors.ts';

export namespace DirectoryString {
  export type Inner =
    | UTF8String.DER
    | PrintableString.DER
    // | BMPString
    | TeletexString.DER;
  // | UniversalString
}

export class DirectoryString<
  T extends DirectoryString.Inner = DirectoryString.Inner,
> {
  constructor(readonly inner: T) {}

  toDER(): T {
    return this.inner;
  }

  static fromASN1<T extends DirectoryString.Inner>(inner: T) {
    return new DirectoryString(inner);
  }

  static resolveOrThrow(parent: DERCursor) {
    const triplet = parent.readOrThrow();

    if (triplet instanceof UTF8String.DER)
      return DirectoryString.fromASN1(triplet);

    if (triplet instanceof PrintableString.DER)
      return DirectoryString.fromASN1(triplet);

    if (triplet instanceof TeletexString.DER)
      return DirectoryString.fromASN1(triplet);

    throw new Unimplemented();
  }
}
