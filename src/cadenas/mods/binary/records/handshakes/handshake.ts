import { Opaque, Writable } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Record } from "mods/binary/records/record.js"

export interface Handshakeable extends Writable {
  readonly handshake_type: number
}

export class Handshake<T extends Writable> {
  readonly #class = Handshake

  static readonly record_type = Record.types.handshake

  static readonly types = {
    hello_request: 0,
    client_hello: 1,
    server_hello: 2,
    certificate: 11,
    server_key_exchange: 12,
    certificate_request: 13,
    server_hello_done: 14,
    certificate_verify: 15,
    client_key_exchange: 16,
    finished: 20,
  } as const

  constructor(
    readonly type: number,
    readonly fragment: T
  ) { }

  static from<T extends Handshakeable>(handshake: T) {
    return new Handshake(handshake.handshake_type, handshake)
  }

  get record_type() {
    return this.#class.record_type
  }

  sizeOrThrow() {
    return 1 + 3 + this.fragment.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.type)

    const size = this.fragment.sizeOrThrow()
    cursor.writeUint24OrThrow(size)

    this.fragment.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    const type = cursor.readUint8OrThrow()
    const size = cursor.readUint24OrThrow()
    const bytes = cursor.readAndCopyOrThrow(size)
    const fragment = new Opaque(bytes)

    return new Handshake<Opaque>(type, fragment)
  }

}