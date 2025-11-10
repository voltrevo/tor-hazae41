import { bitwise_unpack, BitwiseWasm } from "@hazae41/bitwise.wasm"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"

export class Length {

  constructor(
    readonly value: number
  ) { }

  sizeOrThrow() {
    if (this.value < 126)
      return 7
    if (this.value < 65_535)
      return 7 + 16
    return 7 + 64
  }

  #writeOrThrow7(cursor: Cursor) {
    const lengthBytesBytes = new Uint8Array([this.value])

    using lengthBytesMemory = new BitwiseWasm.Memory(lengthBytesBytes)
    using lengthBitsMemory = bitwise_unpack(lengthBytesMemory)

    cursor.writeOrThrow(lengthBitsMemory.bytes.subarray(1)) // 8 - 1
  }

  #writeOrThrow16(cursor: Cursor) {
    const lengthBytesCursor = new Cursor(Bytes.alloc(1 + 2))
    lengthBytesCursor.writeUint8OrThrow(126)
    lengthBytesCursor.writeUint16OrThrow(this.value)

    using lengthBytesMemory = new BitwiseWasm.Memory(lengthBytesCursor.bytes)
    using lengthBitsMemory = bitwise_unpack(lengthBytesMemory)

    cursor.writeOrThrow(lengthBitsMemory.bytes.subarray(1)) // (8 + 16) - 1
  }

  #writeOrThrow64(cursor: Cursor) {
    const subcursor = new Cursor(Bytes.alloc(1 + 8))
    subcursor.writeUint8OrThrow(127)
    subcursor.writeUint64OrThrow(BigInt(this.value))

    using lengthBytesMemory = new BitwiseWasm.Memory(subcursor.bytes)
    using lengthBitsMemory = bitwise_unpack(lengthBytesMemory)

    cursor.writeOrThrow(lengthBitsMemory.bytes.subarray(1)) // (8 + 64) - 1
  }

  writeOrThrow(cursor: Cursor) {
    if (this.value < 126)
      return this.#writeOrThrow7(cursor)
    if (this.value < 65_535)
      return this.#writeOrThrow16(cursor)
    return this.#writeOrThrow64(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    const header = cursor.readOrThrow(7).reduce((p, n) => (p << 1) | n)

    if (header < 126)
      return new Length(header)
    if (header === 126)
      return new Length(cursor.readOrThrow(16).reduce((p, n) => (p << 1) | n))
    return new Length(cursor.readOrThrow(64).reduce((p, n) => (p << 1) | n))
  }

}