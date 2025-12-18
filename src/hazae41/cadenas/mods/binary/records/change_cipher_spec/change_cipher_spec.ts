import { Cursor } from '../../../../../cursor/mod.js';
import { Record } from '../record.js';

export class ChangeCipherSpec {
  readonly #class = ChangeCipherSpec;

  static readonly record_type = Record.types.change_cipher_spec;

  static readonly types = {
    change_cipher_spec: 1,
  } as const;

  constructor(
    readonly type: number = ChangeCipherSpec.types.change_cipher_spec
  ) {}

  static new(type?: number) {
    return new ChangeCipherSpec(type);
  }

  get record_type() {
    return this.#class.record_type;
  }

  sizeOrThrow() {
    return 1;
  }

  writeOrThrow(cursor: Cursor) {
    return cursor.writeUint8OrThrow(this.type);
  }

  static readOrThrow(cursor: Cursor) {
    return new ChangeCipherSpec(cursor.readUint8OrThrow());
  }
}
