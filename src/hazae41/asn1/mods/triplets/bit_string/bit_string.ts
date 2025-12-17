import { Base16 } from '../../../../base16/index.ts';
import { Cursor } from '../../../../cursor/mod.ts';
import { Length } from '../../length/length.ts';
import { DERTriplet } from '../../resolvers/der/triplet.ts';
import { Type } from '../../type/type.ts';

export class BitString {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.BIT_STRING
  );

  constructor(
    readonly type: Type,
    readonly padding: number,
    readonly bytes: Uint8Array<ArrayBuffer>
  ) {}

  static create(
    type = this.type,
    padding: number,
    bytes: Uint8Array<ArrayBuffer>
  ) {
    return new BitString(type, padding, bytes);
  }

  toDER() {
    return BitString.DER.from(this);
  }

  toString() {
    const bignum = BigInt('0x' + Base16.encodeOrThrow(this.bytes));
    const cursor = bignum.toString(2).padStart(this.bytes.length * 8, '0');

    return `BITSTRING ${cursor.slice(0, cursor.length - this.padding)}`;
  }
}

export namespace BitString {
  export class DER extends BitString {
    static readonly type = BitString.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly padding: number,
      readonly bytes: Uint8Array<ArrayBuffer>
    ) {
      super(type, padding, bytes);
    }

    static from(asn1: BitString) {
      const length = new Length(asn1.bytes.length + 1).toDER();

      return new DER(asn1.type.toDER(), length, asn1.padding, asn1.bytes);
    }

    sizeOrThrow() {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor) {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);

      cursor.writeUint8OrThrow(this.padding);
      cursor.writeOrThrow(this.bytes);
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);
      const length = Length.DER.readOrThrow(cursor);

      const subcursor = new Cursor(cursor.readOrThrow(length.value));

      const padding = subcursor.readUint8OrThrow();
      const bytes = new Uint8Array(subcursor.readOrThrow(subcursor.remaining));

      return new DER(type, length, padding, bytes);
    }
  }
}
