import {
  Constructed,
  DERCursor,
  DERTriplet,
  Integer,
  Type,
} from '../../../../asn1/index';
import { Nullable } from '../../../../common/Nullable';

export class TBSCertificateVersion {
  readonly #class = TBSCertificateVersion;

  static readonly type = new Type(
    Type.clazzes.CONTEXT,
    Type.wraps.CONSTRUCTED,
    0
  ).toDER();

  static readonly values = {
    v1: 0n,
    v2: 1n,
    v3: 2n,
  } as const;

  constructor(readonly value: Nullable<Integer>) {}

  toDER(): DERTriplet {
    return new Constructed(this.#class.type, [this.value] as const).toDER();
  }

  static from(value: bigint) {
    return new this(Integer.create(undefined, value).toDER());
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsType(this.type, Constructed.DER);

    if (cursor == null) return undefined;

    const value = cursor.readAsOrThrow(Integer.DER);

    return new TBSCertificateVersion(value);
  }
}
