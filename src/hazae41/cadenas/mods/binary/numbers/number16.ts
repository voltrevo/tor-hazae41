import { Cursor } from '../../../../cursor/mod';

export class Number16 {
  readonly #class = Number16;

  static readonly size = 2 as const;

  constructor(readonly value: number) {}

  static new(value: number) {
    return new Number16(value);
  }

  sizeOrThrow() {
    return this.#class.size;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint16OrThrow(this.value);
  }

  static readOrThrow(cursor: Cursor) {
    return new Number16(cursor.readUint16OrThrow());
  }
}
