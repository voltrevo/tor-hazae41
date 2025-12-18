import { Cursor } from '../../../../cursor/mod';
import { DERable } from '../../resolvers/der/derable';
import { InvalidTypeError } from '../../errors/errors';
import { Length } from '../../length/length';
import { DERTriplet } from '../../resolvers/der/triplet';
import { Triplet } from '../../resolvers/triplet';
import { OpaqueTriplet } from '../opaque/opaque';
import { Type } from '../../type/type';
import { Nullable } from '../../../../common/Nullable';

const stringify = (parent: Constructed) => `[${parent.type.tag}] {
  ${parent.triplets
    .map(it => it?.toString())
    .join(`\n`)
    .replaceAll('\n', '\n' + '  ')}
}`;

export namespace Constructed {
  export type Inner = Nullable<Triplet>;
}

export class Constructed<
  T extends readonly Constructed.Inner[] = readonly Constructed.Inner[],
> {
  constructor(
    readonly type: Type,
    readonly triplets: T
  ) {}

  static create<T extends readonly Constructed.Inner[]>(
    type: Type,
    triplets: T
  ) {
    return new Constructed(type, triplets);
  }

  toDER() {
    return Constructed.DER.from(this);
  }

  toString(): string {
    return stringify(this);
  }
}

export namespace Constructed {
  export namespace DER {
    export type Inner = Nullable<DERTriplet>;
  }

  export class DER<
    T extends readonly DER.Inner[] = readonly DER.Inner[],
  > extends Constructed<T> {
    constructor(
      readonly type: Type.DER,
      readonly length: Length.DER,
      readonly triplets: T
    ) {
      super(type, triplets);
    }

    static from<
      T extends readonly Constructed.Inner[] = readonly Constructed.Inner[],
    >(asn1: Constructed<T>) {
      const triplets = asn1.triplets.map(it =>
        it?.toDER()
      ) as DERable.AllFromOrSelf<T>;
      const size = triplets.reduce(
        (p, c) => p + (c == null ? 0 : c.sizeOrThrow()),
        0
      );
      const length = new Length(size).toDER();

      return new Constructed.DER(asn1.type.toDER(), length, triplets);
    }

    resolveOrThrow(this: DER<OpaqueTriplet.DER[]>) {
      const resolved = this.triplets.map(it => it.resolveOrThrow());

      return new DER(this.type, this.length, resolved);
    }

    sizeOrThrow(): number {
      return DERTriplet.sizeOrThrow(this.length);
    }

    writeOrThrow(cursor: Cursor) {
      this.type.writeOrThrow(cursor);
      this.length.writeOrThrow(cursor);

      for (const triplet of this.triplets) triplet?.writeOrThrow(cursor);

      return;
    }

    static readOrThrow(cursor: Cursor) {
      const type = Type.DER.readOrThrow(cursor);

      if (type.wrap !== Type.wraps.CONSTRUCTED)
        throw new InvalidTypeError(`Constructed`, type.byte);

      const length = Length.DER.readOrThrow(cursor);

      const subcursor = new Cursor(cursor.readOrThrow(length.value));

      const triplets = new Array<OpaqueTriplet.DER>();

      while (subcursor.remaining)
        triplets.push(OpaqueTriplet.DER.readOrThrow(subcursor));

      return new DER(type, length, triplets);
    }
  }
}
