import { Readable } from '../../../../binary/mod.ts';
import { Nullable } from '../../../libs/nullable/index.ts';
import { Class } from '../../../libs/reflection/index.ts';
import { DERTriplet } from './triplet.ts';
import { Opaque } from '../../triplets/opaque/opaque.ts';
import { Type } from '../../type/type.ts';

export interface DERHolder extends DERTriplet {
  readonly triplets: DERTriplet[];
}

export type DERFactory<T extends DERTriplet> = Class<T> & Readable<T>;

export interface DERResolvable<T> {
  readonly struct: DERFactory<DERHolder>;
  resolveOrThrow(cursor: DERCursor): T;
}

export class DERCursor {
  offset = 0;

  constructor(readonly triplets: DERTriplet[]) {}

  get remaining() {
    return this.triplets.length - this.offset;
  }

  get before() {
    return this.triplets.slice(0, this.offset);
  }

  get after() {
    return this.triplets.slice(this.offset);
  }

  get() {
    return this.triplets.at(this.offset);
  }

  getOrThrow() {
    const triplet = this.get();

    if (triplet == null) throw new DERCursor.ReadError();

    return triplet;
  }

  getAs<T extends DERTriplet>(clazz: DERFactory<T>): Nullable<T> {
    const triplet = this.get();

    if (triplet == null) return undefined;

    if (triplet instanceof clazz) return triplet as T;

    if (triplet instanceof Opaque) {
      const resolved = triplet.readIntoOrNull(clazz);

      if (resolved != null) return resolved;
      return undefined;
    }

    return undefined;
  }

  getAsType<T extends DERTriplet>(
    type: Type.DER,
    clazz: DERFactory<T>
  ): Nullable<T> {
    const triplet = this.get();

    if (triplet == null) return undefined;

    if (!triplet.type.equals(type)) return undefined;

    if (triplet instanceof clazz) return triplet as T;

    if (triplet instanceof Opaque) {
      const resolved = triplet.readIntoOrNull(clazz);

      if (resolved != null) return resolved;
      return undefined;
    }

    return undefined;
  }

  read() {
    const triplet = this.get();

    if (triplet != null) this.offset++;

    return triplet;
  }

  readAs<T extends DERTriplet>(clazz: DERFactory<T>): Nullable<T> {
    const triplet = this.getAs(clazz);

    if (triplet != null) this.offset++;

    return triplet;
  }

  readAsType<T extends DERTriplet>(
    type: Type.DER,
    clazz: DERFactory<T>
  ): Nullable<T> {
    const triplet = this.getAsType(type, clazz);

    if (triplet != null) this.offset++;

    return triplet;
  }

  readOrThrow() {
    const triplet = this.read();

    if (triplet == null) throw new DERCursor.ReadError();

    return triplet;
  }

  readAsOrThrow<T extends DERTriplet>(clazz: DERFactory<T>): T {
    const triplet = this.readAs(clazz);

    if (triplet == null) throw new DERCursor.ReadError();

    return triplet;
  }

  readAsTypeOrThrow<T extends DERTriplet>(
    type: Type.DER,
    clazzes: DERFactory<T>
  ): T {
    const triplet = this.readAsType(type, clazzes);

    if (triplet == null) throw new DERCursor.ReadError();

    return triplet;
  }

  subAs<T extends DERHolder>(clazz: DERFactory<T>): Nullable<DERCursor> {
    const triplet = this.readAs(clazz);

    if (triplet == null) return undefined;

    return new DERCursor(triplet.triplets);
  }

  subAsType<T extends DERHolder>(
    type: Type.DER,
    clazz: DERFactory<T>
  ): Nullable<DERCursor> {
    const triplet = this.readAsType(type, clazz);

    if (triplet == null) return undefined;

    return new DERCursor(triplet.triplets);
  }

  subAsOrThrow<T extends DERHolder>(clazz: DERFactory<T>): DERCursor {
    return new DERCursor(this.readAsOrThrow(clazz).triplets);
  }

  subAsTypeOrThrow<T extends DERHolder>(
    type: Type.DER,
    clazz: DERFactory<T>
  ): DERCursor {
    return new DERCursor(this.readAsTypeOrThrow(type, clazz).triplets);
  }

  resolveAsOrThrow<T>(resolvable: DERResolvable<T>): T {
    const struct = this.readAsOrThrow(resolvable.struct);
    const subcursor = new DERCursor(struct.triplets);
    return resolvable.resolveOrThrow(subcursor);
  }

  resolveAsTypeOrThrow<T>(type: Type.DER, resolvable: DERResolvable<T>): T {
    const struct = this.readAsTypeOrThrow(type, resolvable.struct);
    const subcursor = new DERCursor(struct.triplets);
    return resolvable.resolveOrThrow(subcursor);
  }

  resolveAs<T>(resolvable: DERResolvable<T>): Nullable<T> {
    const struct = this.readAs(resolvable.struct);

    if (struct == null) return undefined;

    const subcursor = new DERCursor(struct.triplets);
    return resolvable.resolveOrThrow(subcursor);
  }

  resolveAsType<T>(type: Type.DER, resolvable: DERResolvable<T>): Nullable<T> {
    const struct = this.readAsType(type, resolvable.struct);

    if (struct == null) return undefined;

    const subcursor = new DERCursor(struct.triplets);
    return resolvable.resolveOrThrow(subcursor);
  }
}

export namespace DERCursor {
  export type AnyError = CastError | ReadError;

  export class CastError extends Error {
    readonly #class = CastError;
    readonly name = this.#class.name;

    constructor() {
      super(`Could not cast triplet`);
    }
  }

  export class ReadError extends Error {
    readonly #class = ReadError;
    readonly name = this.#class.name;

    constructor() {
      super(`Could not read triplet`);
    }
  }
}
