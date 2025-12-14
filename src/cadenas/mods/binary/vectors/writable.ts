import { Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { NumberClass, NumberX } from "mods/binary/numbers/number.js";

export interface Vector<L extends NumberX, T extends Writable> extends Writable {
  readonly length: NumberClass<L>
  readonly value: T
}

export const Vector = <L extends NumberX>($length: NumberClass<L>) => class <T extends Writable> {

  constructor(
    readonly value: T
  ) { }

  static from<T extends Writable>(value: T) {
    return new this(value)
  }

  get length() {
    return $length
  }

  sizeOrThrow() {
    return $length.size + this.value.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    const size = this.value.sizeOrThrow()
    new $length(size).writeOrThrow(cursor)

    this.value.writeOrThrow(cursor)
  }

}