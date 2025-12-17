import { Base16 } from '../../../../base16/index';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Type } from '../../type/type';

export class OctetString {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.OCTET_STRING
  );

  constructor(
    readonly type: Type,
    readonly bytes: Bytes
  ) {}

  static create(type = this.type, bytes: Bytes) {
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
      readonly bytes: Bytes
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

      const bytes = Bytes.from(cursor.readOrThrow(length.value));

      return new DER(type, length, bytes);
    }
  }
}
