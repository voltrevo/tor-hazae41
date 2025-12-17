import { Number8 } from '../../../../../mods/binary/numbers/number8.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';
import { SafeUnknown } from '../../../../../../hazae41/binary/mods/binary/safe-unknown/mod.js';
import { Unknown } from '../../../../../../hazae41/binary/mod.js';

export class ECPoint {
  constructor(readonly point: Vector<Number8, Unknown>) {}

  static new(point: Vector<Number8, Unknown>) {
    return new ECPoint(point);
  }

  static from(bytes: Bytes) {
    const point = Vector(Number8).from(new Unknown(bytes));

    return new this(point);
  }

  sizeOrThrow() {
    return this.point.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.point.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ECPoint(
      ReadableVector(Number8, SafeUnknown).readOrThrow(cursor)
    );
  }
}
