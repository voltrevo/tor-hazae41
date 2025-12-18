import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { InvalidValueError } from '../../errors/errors';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Type } from '../../type/type';

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

export class UTCTime {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.UTC_TIME
  );

  constructor(
    readonly type: Type,
    readonly value: Date
  ) {}

  static create(type = this.type, value: Date) {
    return new UTCTime(type, value);
  }

  toDER() {
    return UTCTime.DER.from(this);
  }

  toString() {
    return `UTCTime ${this.value.toUTCString()}`;
  }
}

export namespace UTCTime {
  export class DER extends UTCTime {
    static readonly type = UTCTime.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly value: Date,
      readonly bytes: Bytes
    ) {
      super(type, value);
    }

    static from(asn1: UTCTime) {
      const year = asn1.value.getUTCFullYear();

      const YY = year > 2000 ? pad2(year - 2000) : pad2(year - 1900);

      const MM = pad2(asn1.value.getUTCMonth() + 1);
      const DD = pad2(asn1.value.getUTCDate());
      const hh = pad2(asn1.value.getUTCHours());
      const mm = pad2(asn1.value.getUTCMinutes());
      const ss = pad2(asn1.value.getUTCSeconds());

      const bytes = Bytes.encodeUtf8(`${YY}${MM}${DD}${hh}${mm}${ss}Z`);
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

      const bytes = Bytes.from(cursor.readOrThrow(length.value));
      const text = new TextDecoder().decode(bytes);

      if (text.length !== 13) throw new InvalidValueError(`UTCTime`, text);
      if (!text.endsWith('Z')) throw new InvalidValueError(`UTCTime`, text);

      const YY = Number(text.slice(0, 2));
      const MM = Number(text.slice(2, 4));
      const DD = Number(text.slice(4, 6));
      const hh = Number(text.slice(6, 8));
      const mm = Number(text.slice(8, 10));
      const ss = Number(text.slice(10, 12));

      const year = YY > 50 ? 1900 + YY : 2000 + YY;

      const value = new Date();
      value.setUTCFullYear(year, MM - 1, DD);
      value.setUTCHours(hh, mm, ss);
      value.setUTCMilliseconds(0);

      return new DER(type, length, value, bytes);
    }
  }
}
