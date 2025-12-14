import { Cursor } from "@hazae41/cursor";
import { ECPoint } from "../server_key_exchange/ec_point.js";

export class ClientECDiffieHellmanPublic {

  constructor(
    readonly ecdh_Yc: ECPoint
  ) { }

  static new(ecdh_Yc: ECPoint) {
    return new ClientECDiffieHellmanPublic(ecdh_Yc)
  }

  static from(bytes: Uint8Array) {
    return new ClientECDiffieHellmanPublic(ECPoint.from(bytes))
  }

  sizeOrThrow() {
    return this.ecdh_Yc.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    return this.ecdh_Yc.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientECDiffieHellmanPublic(ECPoint.readOrThrow(cursor))
  }

}