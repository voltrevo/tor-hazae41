import { Cursor } from '../../../../cursor/mod.ts';
import { Numbers } from '../../../libs/numbers/index.ts';
import { InvalidValueError } from '../../errors/errors.ts';
import { Length } from '../../length/length.ts';
import { DERTriplet } from '../../resolvers/der/triplet.ts';
import { Type } from '../../type/type.ts';
import { VLQ } from '../../variable_length_quantity/variable_length_quantity.ts';

export class NotAnOID extends Error {
  readonly #class = NotAnOID;
  readonly name = this.#class.name;

  constructor(readonly text: string) {
    super(`${text} is not an OID`);
  }
}

export class ObjectIdentifier<T extends string = string> {
  static readonly type = Type.create(
    Type.clazzes.UNIVERSAL,
    Type.wraps.PRIMITIVE,
    Type.tags.OBJECT_IDENTIFIER
  );

  constructor(
    readonly type: Type,
    readonly value: T
  ) {}

  static is(value: string) {
    return value
      .split('.')
      .every(x => Numbers.isSafeNonNegativeInteger(Number(x)));
  }

  static create<T extends string>(type = this.type, value: T) {
    return new ObjectIdentifier(type, value);
  }

  static createOrThrow<T extends string>(type = this.type, value: T) {
    if (!ObjectIdentifier.is(value))
      throw new InvalidValueError(`ObjectIdentifier`, value);
    return new ObjectIdentifier(type, value);
  }

  toDER() {
    return ObjectIdentifier.DER.from(this);
  }

  toString() {
    return `OBJECT IDENTIFIER ${this.value}`;
  }
}

export namespace ObjectIdentifier {
  export class DER<T extends string = string> extends ObjectIdentifier {
    static readonly type = ObjectIdentifier.type.toDER();

    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly value: T,
      readonly head: readonly number[],
      readonly body: readonly VLQ.DER[]
    ) {
      super(type, value);
    }

    static from<T extends string = string>(asn1: ObjectIdentifier<T>) {
      const texts = asn1.value.split('.');

      const first = Number(texts[0]);
      const second = Number(texts[1]);
      const head = [first, second];

      let size = 1;

      const body = new Array<VLQ.DER>();

      for (let i = 2; i < texts.length; i++) {
        const vlq = new VLQ(Number(texts[i])).toDER();
        size += vlq.sizeOrThrow();
        body.push(vlq);
      }

      const length = new Length(size).toDER();

      return new DER(asn1.type.toDER(), length, asn1.value, head, body);
    }

    sizeOrThrow() {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor) {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);

      const [first, second] = this.head;
      cursor.writeUint8OrThrow(first * 40 + second);

      for (const vlq of this.body) vlq.writeOrThrow(cursor);

      return;
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);
      const length = Length.DER.readOrThrow(cursor);

      const subcursor = new Cursor(cursor.readOrThrow(length.value));

      const byte = subcursor.readUint8OrThrow();
      const first = Math.floor(byte / 40);
      const second = byte % 40;

      const head = [first, second];
      const body = new Array<VLQ.DER>();

      const all = [first, second];

      while (subcursor.remaining) {
        const vlq = VLQ.DER.readOrThrow(subcursor);
        body.push(vlq);
        all.push(vlq.value);
      }

      const value = all.join('.');

      if (!ObjectIdentifier.is(value))
        throw new InvalidValueError(`ObjectIdentifier`, value);

      return new DER(type, length, value, head, body);
    }
  }
}
