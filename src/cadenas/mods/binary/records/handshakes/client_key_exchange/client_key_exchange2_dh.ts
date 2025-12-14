import { Cursor } from "@hazae41/cursor";
import { ClientDiffieHellmanPublic } from "mods/binary/records/handshakes/client_key_exchange/client_diffie_hellman_public.js";
import { Handshake } from "mods/binary/records/handshakes/handshake.js";

export class ClientKeyExchange2DH {
  readonly #class = ClientKeyExchange2DH

  static readonly handshake_type = Handshake.types.client_key_exchange

  constructor(
    readonly exchange_keys: ClientDiffieHellmanPublic
  ) { }

  static new(exchange_keys: ClientDiffieHellmanPublic) {
    return new ClientKeyExchange2DH(exchange_keys)
  }

  static from(bytes: Uint8Array) {
    return new ClientKeyExchange2DH(ClientDiffieHellmanPublic.from(bytes))
  }

  get handshake_type() {
    return this.#class.handshake_type
  }

  sizeOrThrow() {
    return this.exchange_keys.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    this.exchange_keys.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientKeyExchange2DH(ClientDiffieHellmanPublic.readOrThrow(cursor))
  }

}