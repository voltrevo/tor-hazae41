import { Opaque, SafeOpaque } from '@hazae41/binary';
import { Cursor } from '@hazae41/cursor';
import { Number8 } from '../../../../../mods/binary/numbers/number8.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';

export class ECPoint {
  constructor(readonly point: Vector<Number8, Opaque>) {}

  static new(point: Vector<Number8, Opaque>) {
    return new ECPoint(point);
  }

  static from(bytes: Bytes) {
    const point = Vector(Number8).from(new Opaque(bytes));

    return new this(point);
  }

  sizeOrThrow() {
    return this.point.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.point.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ECPoint(ReadableVector(Number8, SafeOpaque).readOrThrow(cursor));
  }
}
