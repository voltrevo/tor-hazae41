import { Cursor } from "@hazae41/cursor"

export class NameType {

  static readonly types = {
    host_name: 0,
  } as const

  static readonly instances = {
    host_name: new NameType(NameType.types.host_name),
  } as const

  constructor(
    readonly type: number
  ) { }

  static new(type: number) {
    return new NameType(type)
  }

  sizeOrThrow() {
    return 1
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.type)
  }

  static readOrThrow(cursor: Cursor) {
    return new NameType(cursor.readUint8OrThrow())
  }

}