import { Cursor } from '../../../../../../../hazae41/cursor/mod.js';
import { NamedCurveList } from '../../../../../../mods/binary/records/handshakes/extensions/elliptic_curves/named_curve_list.js';
import { Extension } from '../../../../../../mods/binary/records/handshakes/extensions/extension.js';

export class EllipticCurves {
  readonly #class = EllipticCurves;

  static readonly extension_type = Extension.types.elliptic_curves;

  constructor(readonly named_curve_list: NamedCurveList) {}

  static new(named_curve_list: NamedCurveList) {
    return new EllipticCurves(named_curve_list);
  }

  static default() {
    return new this(NamedCurveList.default());
  }

  get extension_type() {
    return this.#class.extension_type;
  }

  sizeOrThrow() {
    return this.named_curve_list.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    return this.named_curve_list.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new EllipticCurves(NamedCurveList.readOrThrow(cursor));
  }
}
