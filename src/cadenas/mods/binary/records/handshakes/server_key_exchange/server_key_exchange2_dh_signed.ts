import { Cursor } from "@hazae41/cursor"
import { Handshake } from "mods/binary/records/handshakes/handshake.js"
import { ServerDHParams } from "mods/binary/records/handshakes/server_key_exchange/server_dh_params.js"
import { DigitallySigned } from "mods/binary/signatures/digitally_signed.js"

export class ServerKeyExchange2DHSigned {

  static readonly type = Handshake.types.server_key_exchange

  constructor(
    readonly params: ServerDHParams,
    readonly signed_params: DigitallySigned
  ) { }

  sizeOrThrow() {
    return 0
      + this.params.sizeOrThrow()
      + this.signed_params.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    this.params.writeOrThrow(cursor)
    this.signed_params.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    const params = ServerDHParams.readOrThrow(cursor)
    const signed_params = DigitallySigned.readOrThrow(cursor)

    return new ServerKeyExchange2DHSigned(params, signed_params)
  }
}