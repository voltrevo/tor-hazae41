import { Opaque, SafeOpaque } from '@hazae41/binary';
import { Number16 } from '../../../../../mods/binary/numbers/number16.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';

export class ServerDHParams {
  constructor(
    readonly dh_p: Vector<Number16, Opaque>,
    readonly dh_g: Vector<Number16, Opaque>,
    readonly dh_Ys: Vector<Number16, Opaque>
  ) {}

  sizeOrThrow() {
    return (
      0 +
      this.dh_p.sizeOrThrow() +
      this.dh_g.sizeOrThrow() +
      this.dh_Ys.sizeOrThrow()
    );
  }

  writeOrThrow(cursor: Cursor) {
    this.dh_p.writeOrThrow(cursor);
    this.dh_g.writeOrThrow(cursor);
    this.dh_Ys.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const dh_p = ReadableVector(Number16, SafeOpaque).readOrThrow(cursor);
    const dh_g = ReadableVector(Number16, SafeOpaque).readOrThrow(cursor);
    const dh_Ys = ReadableVector(Number16, SafeOpaque).readOrThrow(cursor);

    return new ServerDHParams(dh_p, dh_g, dh_Ys);
  }
}
