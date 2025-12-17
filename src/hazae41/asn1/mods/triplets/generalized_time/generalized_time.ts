import { Cursor } from '../../../../cursor/mod';
import { InvalidValueError } from '../../errors/errors';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Type } from '../../type/type';
import { Bytes } from '../../../../../cadenas/libs/bytes/index.js';

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

function pad4(value: number) {
  return value.toString().padStart(4, '0');
}

export class GeneralizedTime {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.GENERALIZED_TIME
  );

  constructor(
    readonly type: Type,
    readonly value: Date
  ) {}

  static create(type = this.type, value: Date) {
    return new GeneralizedTime(type, value);
  }

  toDER() {
    return GeneralizedTime.DER.from(this);
  }

  toString() {
    return `GeneralizedTime ${this.value.toUTCString()}`;
  }
}

export namespace GeneralizedTime {
  export class DER extends GeneralizedTime {
    static readonly type = GeneralizedTime.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly value: Date,
      readonly bytes: Uint8Array<ArrayBuffer>
    ) {
      super(type, value);
    }

    static from(asn1: GeneralizedTime) {
      const year = asn1.value.getUTCFullYear();

      const YYYY = pad4(year);

      const MM = pad2(asn1.value.getUTCMonth() + 1);
      const DD = pad2(asn1.value.getUTCDate());
      const hh = pad2(asn1.value.getUTCHours());
      const mm = pad2(asn1.value.getUTCMinutes());
      const ss = pad2(asn1.value.getUTCSeconds());

      const bytes = Bytes.encodeUtf8(`${YYYY}${MM}${DD}${hh}${mm}${ss}Z`);
      const length = new Length(bytes.length).toDER();

      return new DER(asn1.type.toDER(), length, asn1.value, bytes);
    }

    sizeOrThrow(): number {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor): void {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);

      cursor.writeOrThrow(this.bytes);
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);
      const length = Length.DER.readOrThrow(cursor);

      const bytes = new Uint8Array(cursor.readOrThrow(length.value));
      const text = new TextDecoder().decode(bytes);

      if (text.length !== 15)
        throw new InvalidValueError(`GeneralizedTime`, text);
      if (!text.endsWith('Z'))
        throw new InvalidValueError(`GeneralizedTime`, text);

      const YYYY = Number(text.slice(0, 4));

      const MM = Number(text.slice(4, 6));
      const DD = Number(text.slice(6, 8));
      const hh = Number(text.slice(8, 10));
      const mm = Number(text.slice(10, 12));
      const ss = Number(text.slice(12, 14));

      const value = new Date();
      value.setUTCFullYear(YYYY, MM - 1, DD);
      value.setUTCHours(hh, mm, ss);
      value.setUTCMilliseconds(0);

      return new DER(type, length, value, bytes);
    }
  }
}
