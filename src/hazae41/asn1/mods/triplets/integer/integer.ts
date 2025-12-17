import { Cursor } from '../../../../cursor/mod.ts';
import { Length } from '../../length/length.ts';
import { DERTriplet } from '../../resolvers/der/triplet.ts';
import { Type } from '../../type/type.ts';

const bn256 = BigInt(256);

export class Integer {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.INTEGER
  );

  constructor(
    readonly type: Type,
    readonly value: bigint
  ) {}

  static create(type = this.type, value: bigint) {
    return new Integer(type, value);
  }

  toDER() {
    return Integer.DER.from(this);
  }

  toString() {
    return `INTEGER ${this.value}`;
  }
}

export namespace Integer {
  export class DER extends Integer {
    static readonly type = Integer.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly value: bigint,
      readonly values: Array<number>
    ) {
      super(type, value);
    }

    static from(asn1: Integer) {
      let divided = asn1.value < 0 ? ~asn1.value : asn1.value;

      const values = new Array<number>();

      do {
        values.push(Number(divided % bn256));
        divided /= bn256;
      } while (divided);

      if (values[values.length - 1] > 127) values.push(0);

      values.reverse();

      const length = new Length(values.length).toDER();

      return new DER(asn1.type.toDER(), length, asn1.value, values);
    }

    sizeOrThrow(): number {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor) {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);

      const negative = this.value < 0;

      let first = this.values[0];

      if (negative) {
        /**
         * Bitwise NOT
         */
        first = (1 << 8) - first - 1;

        /**
         * Enable the first BE bit
         */
        first |= 1 << (8 - 0 - 1);
      }

      cursor.writeUint8OrThrow(first);

      for (let i = 1; i < this.values.length; i++) {
        let byte = this.values[i];

        if (negative)
          /**
           * Bitwise NOT
           */
          byte = (1 << 8) - byte - 1;

        cursor.writeUint8OrThrow(byte);
      }

      return;
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);
      const length = Length.DER.readOrThrow(cursor);

      let value = BigInt(0);

      const values = new Array<number>();

      const negative = cursor.getUint8OrThrow() & (1 << (8 - 0 - 1));

      for (let i = 0; i < length.value; i++) {
        let byte = cursor.readUint8OrThrow();

        if (negative)
          /**
           * Bitwise NOT
           */
          byte = (1 << 8) - byte - 1;

        value = value * bn256 + BigInt(byte);
        values.push(byte);
      }

      if (negative) value = ~value;

      return new DER(type, length, value, values);
    }
  }
}
