import {
  Constructed,
  DERCursor,
  DERTriplet,
  IA5String,
  ObjectIdentifier,
  Sequence,
  Type,
} from '../../../../../asn1';

export class SubjectAltName {
  constructor(readonly inner: GeneralNames) {}

  toDER() {
    return this.inner.toDER();
  }

  static resolveOrThrow(parent: DERCursor) {
    return new SubjectAltName(GeneralNames.resolveOrThrow(parent));
  }
}

export class GeneralNames {
  constructor(readonly names: GeneralName[]) {}

  toDER() {
    return Sequence.create(
      undefined,
      this.names.map(it => it.toDER())
    ).toDER();
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER);
    const names = cursor.triplets.map(() => GeneralName.resolveOrThrow(cursor));

    return new GeneralNames(names);
  }
}

export type GeneralName = OtherName | DERTriplet;

export namespace GeneralName {
  export function resolveOrThrow(cursor: DERCursor) {
    const otherName = cursor.resolveAsType(
      Type.DER.context(true, 0),
      OtherName
    );

    if (otherName != null) return otherName;

    const rfc822Name = cursor.readAsType(
      Type.DER.context(false, 1),
      IA5String.DER
    );

    if (rfc822Name != null) return rfc822Name;

    const dnsName = cursor.readAsType(
      Type.DER.context(false, 2),
      IA5String.DER
    );

    if (dnsName != null) return dnsName;

    return cursor.readOrThrow();
  }
}

export class OtherName {
  static readonly struct = Sequence.DER;

  constructor(
    readonly identifier: ObjectIdentifier.DER,
    readonly value: OtherNameValue
  ) {}

  toDER() {
    return OtherName.struct
      .create(Type.DER.context(true, 0), [
        this.identifier,
        this.value.toDER(),
      ] as const)
      .toDER();
  }

  static resolveOrThrow(cursor: DERCursor) {
    const identifier = cursor.readAsOrThrow(ObjectIdentifier.DER);
    const value = OtherNameValue.resolveOrThrow(cursor);

    return new OtherName(identifier, value);
  }
}

export class OtherNameValue {
  static readonly type = new Type(
    Type.clazzes.CONTEXT,
    Type.wraps.CONSTRUCTED,
    0
  ).toDER();

  constructor(readonly triplet: DERTriplet) {}

  toDER() {
    return Constructed.create(OtherNameValue.type, [
      this.triplet,
    ] as const).toDER();
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsTypeOrThrow(
      OtherNameValue.type,
      Constructed.DER
    );
    const triplet = cursor.readOrThrow();

    return new OtherNameValue(triplet);
  }
}
