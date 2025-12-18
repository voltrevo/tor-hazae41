import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { InvalidValueError } from '../../errors/errors';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Type } from '../../type/type';

export class IA5String {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.IA5_STRING
  );

  constructor(
    readonly type: Type,
    readonly value: string
  ) {}

  static is(value: string) {
    /**
     * ASCII
     */
    // eslint-disable-next-line no-control-regex
    return /^[\x00-\x7F]*$/.test(value);
  }

  static createOrThrow(type = this.type, value: string) {
    if (!IA5String.is(value)) throw new InvalidValueError(`IA5String`, value);

    return new IA5String(type, value);
  }

  toDER() {
    return IA5String.DER.from(this);
  }

  toString() {
    return `IA5String ${this.value}`;
  }
}

export namespace IA5String {
  export class DER extends IA5String {
    static readonly type = IA5String.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly value: string,
      readonly bytes: Bytes
    ) {
      super(type, value);
    }

    static from(asn1: IA5String) {
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

      if (!IA5String.is(value)) throw new InvalidValueError(`IA5String`, value);

      return new DER(type, length, value, bytes);
    }
  }
}
