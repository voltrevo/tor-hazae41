import { Cursor } from '@hazae41/cursor';
import { ReadableList } from '../../../../../../mods/binary/lists/readable.js';
import { List } from '../../../../../../mods/binary/lists/writable.js';
import { Number16 } from '../../../../../../mods/binary/numbers/number16.js';
import { NamedCurve } from '../../../../../../mods/binary/records/handshakes/extensions/elliptic_curves/named_curve.js';
import { ReadableVector } from '../../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../../mods/binary/vectors/writable.js';

export class NamedCurveList {
  constructor(readonly named_curve_list: Vector<Number16, List<NamedCurve>>) {}

  static new(named_curve_list: Vector<Number16, List<NamedCurve>>) {
    return new NamedCurveList(named_curve_list);
  }

  static default() {
    const {
      secp256r1,
      secp384r1: _1,
      secp521r1: _2,
      x25519: _3,
      x448: _4,
    } = NamedCurve.instances;

    return this.from([secp256r1]); // TODO
  }

  static from(named_curves: NamedCurve[]) {
    const named_curve_list = Vector(Number16).from(List.from(named_curves));

    return new this(named_curve_list);
  }

  sizeOrThrow() {
    return this.named_curve_list.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.named_curve_list.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new NamedCurveList(
      ReadableVector(Number16, ReadableList(NamedCurve)).readOrThrow(cursor)
    );
  }
}
