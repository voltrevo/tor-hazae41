import { ECPoint } from '../server_key_exchange/ec_point.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';

export class ClientECDiffieHellmanPublic {
  constructor(readonly ecdh_Yc: ECPoint) {}

  static new(ecdh_Yc: ECPoint) {
    return new ClientECDiffieHellmanPublic(ecdh_Yc);
  }

  static from(bytes: Bytes) {
    return new ClientECDiffieHellmanPublic(ECPoint.from(bytes));
  }

  sizeOrThrow() {
    return this.ecdh_Yc.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    return this.ecdh_Yc.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientECDiffieHellmanPublic(ECPoint.readOrThrow(cursor));
  }
}
