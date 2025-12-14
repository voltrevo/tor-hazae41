import { Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Number16 } from "mods/binary/numbers/number16.js";
import { Vector } from "mods/binary/vectors/writable.js";

export interface Extensionable extends Writable {
  readonly extension_type: number
}

export class Extension<T extends Writable = Writable> {

  static readonly types = {
    server_name: 0,
    elliptic_curves: 10,
    ec_point_formats: 11,
    signature_algorithms: 13
  } as const

  constructor(
    readonly type: number,
    readonly data: Vector<Number16, T>
  ) { }

  static from<T extends Extensionable>(extension: T) {
    const extension_data = Vector(Number16).from(extension)

    return new Extension(extension.extension_type, extension_data)
  }

  sizeOrThrow() {
    return 2 + this.data.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint16OrThrow(this.type)
    this.data.writeOrThrow(cursor)
  }

}