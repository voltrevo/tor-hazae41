import { Cursor } from '@hazae41/cursor';

export class Number8 {
  readonly #class = Number8;

  static readonly size = 1 as const;

  constructor(readonly value: number) {}

  static new(value: number) {
    return new Number8(value);
  }

  sizeOrThrow() {
    return this.#class.size;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.value);
  }

  static readOrThrow(cursor: Cursor) {
    return new Number8(cursor.readUint8OrThrow());
  }
}
