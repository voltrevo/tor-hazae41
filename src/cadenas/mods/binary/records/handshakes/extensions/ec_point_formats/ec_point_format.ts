import { Cursor } from "@hazae41/cursor"

export class ECPointFormat {

  static readonly types = {
    uncompressed: 0,
    // deprecated: 1..2,
    // reserved: 248..255
  } as const

  static readonly instances = {
    uncompressed: new this(this.types.uncompressed)
  } as const

  constructor(
    readonly value: number
  ) { }

  static new(value: number) {
    return new ECPointFormat(value)
  }

  sizeOrThrow() {
    return 1
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.value)
  }

  static readOrThrow(cursor: Cursor) {
    return new ECPointFormat(cursor.readUint8OrThrow())
  }

}
