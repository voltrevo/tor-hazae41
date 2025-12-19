import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Type } from '../../type/type';

export class TeletexString {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.TELETEX_STRING
  );

  constructor(
    readonly type: Type,
    readonly value: string
  ) {}

  static is(_value: string) {
    /**
     * TODO T.61
     */
    return true;
  }

  static create(type = this.type, value: string) {
    return new TeletexString(type, value);
  }

  toDER() {
    return TeletexString.DER.from(this);
  }

  toString() {
    return `TeletexString ${this.value}`;
  }
}

export namespace TeletexString {
  export class DER extends TeletexString {
    static readonly type = TeletexString.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly value: string,
      readonly bytes: Bytes
    ) {
      super(type, value);
    }

    static from(asn1: TeletexString) {
      const bytes = Bytes.encodeUtf8(asn1.value);
      const length = new Length(bytes.length).toDER();

      return new DER(asn1.type.toDER(), length, asn1.value, bytes);
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
      const value = new TextDecoder().decode(bytes);

      return new DER(type, length, value, bytes);
    }
  }
}
