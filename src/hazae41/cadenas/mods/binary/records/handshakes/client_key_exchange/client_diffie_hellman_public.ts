import { Number16 } from '../../../numbers/number16.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { Vector } from '../../../vectors/writable.js';
import { Bytes } from '../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../cursor/mod.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown';

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
