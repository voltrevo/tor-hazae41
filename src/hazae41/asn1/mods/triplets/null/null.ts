import { Cursor } from '../../../../cursor';
import { InvalidLengthError } from '../../errors/errors';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Type } from '../../type/type';

export class Null {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.NULL
  );

  constructor(readonly type: Type) {}

  static create(type = this.type) {
    return new Null(type);
  }

  toDER() {
    return Null.DER.from(this);
  }

  toString() {
    return `NULL`;
  }
}

export namespace Null {
  export class DER extends Null {
    static readonly type = Null.type.toDER();
    static readonly length = new Length(0).toDER();

    constructor(readonly type: Type.DER) {
      super(type);
    }

    get length() {
      return DER.length;
    }

    static from(asn1: Null) {
      return new DER(asn1.type.toDER());
    }

    sizeOrThrow() {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor) {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);
      const length = Length.DER.readOrThrow(cursor);

      if (length.value !== 0)
        throw new InvalidLengthError(`Null`, length.value);

      return new DER(type);
    }
  }
}
