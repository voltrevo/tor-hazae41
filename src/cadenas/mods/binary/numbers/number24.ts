import { Cursor } from '../../../../hazae41/cursor/mod';

export class Number24 {
  readonly #class = Number24;

  static readonly size = 3 as const;

  constructor(readonly value: number) {}

  static new(value: number) {
    return new Number24(value);
  }

  sizeOrThrow() {
    return this.#class.size;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint24OrThrow(this.value);
  }

  static readOrThrow(cursor: Cursor) {
    return new Number24(cursor.readUint24OrThrow());
  }
}
