import {
  Boolean,
  Constructed,
  DER,
  DERCursor,
  DERable,
  ObjectIdentifier,
  OctetString,
  Sequence,
  Type,
} from '../../../../asn1/index';
import { Readable, Writable } from '../../../../binary/mod';
import { Nullable } from '../../../libs/nullable/index';
import { OIDs } from '../../oids/oids';
import { SubjectAltName } from './subject_alt_name/subject_alt_name';

export class Extensions {
  static readonly type = new Type(
    Type.clazzes.CONTEXT,
    Type.wraps.CONSTRUCTED,
    3
  ).toDER();

  constructor(readonly extensions: Extension[]) {}

  toDER(): Constructed.DER<any> {
    return Constructed.create(Extensions.type, [
      Sequence.create(
        undefined,
        this.extensions.map(ext => ext.toDER())
      ).toDER(),
    ]).toDER();
  }

  static resolveOrThrow(parent: DERCursor) {
    const explicit = parent.subAsType(this.type, Constructed.DER);

    if (explicit == null) return undefined;

    const sequence = explicit.subAsOrThrow(Sequence.DER);

    if (sequence.triplets.length === 0)
      throw new Error('Extensions must be non-empty');

    return new Extensions(
      sequence.triplets.map(() => Extension.resolveOrThrow(sequence))
    );
  }
}

export class Extension<T extends DERable = DERable> {
  constructor(
    readonly extnID: ObjectIdentifier.DER,
    readonly critical: Nullable<Boolean.DER>,
    readonly extnValue: T
  ) {}

  toDER(): Sequence.DER<any> {
    const bytes = Writable.writeToBytesOrThrow(this.extnValue.toDER());
    const extnValue = OctetString.create(undefined, bytes);

    return Sequence.create(undefined, [
      this.extnID,
      this.critical,
      extnValue,
    ] as const).toDER();
  }

  static resolveOrThrow(parent: DERCursor): Extension<DERable> {
    const cursor = parent.subAsOrThrow(Sequence.DER);

    const identifier = cursor.readAsOrThrow(ObjectIdentifier.DER);
    const critical = cursor.readAs(Boolean.DER);
    const string = cursor.readAsOrThrow(OctetString.DER);
    const asn1 = Readable.readFromBytesOrThrow(DER, string.bytes);

    if (identifier.value === OIDs.keys.subjectAltName) {
      const inner = SubjectAltName.resolveOrThrow(new DERCursor([asn1]));

      return new Extension(identifier, critical, inner);
    }

    return new Extension(identifier, critical, asn1);
  }
}
