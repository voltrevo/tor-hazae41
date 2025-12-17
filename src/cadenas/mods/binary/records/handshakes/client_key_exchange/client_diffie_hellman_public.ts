import { Number16 } from '../../../../../mods/binary/numbers/number16.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';
import { Unknown } from '../../../../../../hazae41/binary/mod.js';
import { SafeUnknown } from '../../../../../../hazae41/binary/mods/binary/safe-unknown/mod.js';

export class ClientDiffieHellmanPublic {
  constructor(readonly dh_Yc: Vector<Number16, Unknown>) {}

  static new(dh_Yc: Vector<Number16, Unknown>) {
    return new ClientDiffieHellmanPublic(dh_Yc);
  }

  static from(bytes: Bytes) {
    const dh_Yc = Vector(Number16).from(new Unknown(bytes));

    return new ClientDiffieHellmanPublic(dh_Yc);
  }

  sizeOrThrow() {
    return this.dh_Yc.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.dh_Yc.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientDiffieHellmanPublic(
      ReadableVector(Number16, SafeUnknown).readOrThrow(cursor)
    );
  }
}
