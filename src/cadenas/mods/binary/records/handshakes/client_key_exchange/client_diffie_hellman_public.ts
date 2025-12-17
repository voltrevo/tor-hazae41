import { Opaque, SafeOpaque } from '@hazae41/binary';
import { Cursor } from '@hazae41/cursor';
import { Number16 } from '../../../../../mods/binary/numbers/number16.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';

export class ClientDiffieHellmanPublic {
  constructor(readonly dh_Yc: Vector<Number16, Opaque>) {}

  static new(dh_Yc: Vector<Number16, Opaque>) {
    return new ClientDiffieHellmanPublic(dh_Yc);
  }

  static from(bytes: Bytes) {
    const dh_Yc = Vector(Number16).from(Opaque.new(bytes));

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
      ReadableVector(Number16, SafeOpaque).readOrThrow(cursor)
    );
  }
}
