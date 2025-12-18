import { Number8 } from '../../../numbers/number8.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { Vector } from '../../../vectors/writable.js';
import { Bytes } from '../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../cursor/mod.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown/mod.js';

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
