import { Base16 } from '../../../../base16/index.ts';
import { Cursor } from '../../../../cursor/mod.ts';
import { Length } from '../../length/length.ts';
import { DERTriplet } from '../../resolvers/der/triplet.ts';
import { Type } from '../../type/type.ts';

export class OctetString {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.OCTET_STRING
  );

  constructor(
    readonly type: Type,
    readonly bytes: Uint8Array<ArrayBuffer>
  ) {}

  static create(type = this.type, bytes: Uint8Array<ArrayBuffer>) {
    return new OctetString(type, bytes);
  }

  toDER() {
    return OctetString.DER.from(this);
  }

  toString() {
    return `OCTET STRING ${Base16.encodeOrThrow(this.bytes)}`;
  }
}

export namespace OctetString {
  export class DER extends OctetString {
    static readonly type = OctetString.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly bytes: Uint8Array<ArrayBuffer>
    ) {
      super(type, bytes);
    }

    static from(asn1: OctetString) {
      const length = new Length(asn1.bytes.length).toDER();

      return new DER(asn1.type.toDER(), length, asn1.bytes);
    }

    sizeOrThrow() {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor) {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);

      cursor.writeOrThrow(this.bytes);
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);
      const length = Length.DER.readOrThrow(cursor);

      const bytes = new Uint8Array(cursor.readOrThrow(length.value));

      return new DER(type, length, bytes);
    }
  }
}
