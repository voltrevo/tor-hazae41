import { Cursor } from '../../../../../../cursor/mod.js';
import { ECParameters } from './ec_parameters.js';
import { ECPoint } from './ec_point.js';

export class ServerECDHParams {
  constructor(
    readonly curve_params: ECParameters,
    readonly public_point: ECPoint
  ) {}

  sizeOrThrow() {
    return this.curve_params.sizeOrThrow() + this.public_point.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.curve_params.writeOrThrow(cursor);
    this.public_point.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const curve_params = ECParameters.readOrThrow(cursor);
    const public_point = ECPoint.readOrThrow(cursor);

    return new ServerECDHParams(curve_params, public_point);
  }
}
