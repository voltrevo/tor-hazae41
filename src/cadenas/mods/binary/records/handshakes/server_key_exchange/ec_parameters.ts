import { Cursor } from "@hazae41/cursor";
import { NamedCurve } from "mods/binary/records/handshakes/extensions/elliptic_curves/named_curve.js";
import { ECCurveType } from "./ec_curve_type.js";

export class ECParameters {

  constructor(
    readonly curve_type: ECCurveType,
    readonly named_curve: NamedCurve
  ) { }

  sizeOrThrow() {
    return this.curve_type.sizeOrThrow() + this.named_curve.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    this.curve_type.writeOrThrow(cursor)
    this.named_curve.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    const curve_type = ECCurveType.readOrThrow(cursor)
    const named_curve = NamedCurve.readOrThrow(cursor)

    return new ECParameters(curve_type, named_curve)
  }

}