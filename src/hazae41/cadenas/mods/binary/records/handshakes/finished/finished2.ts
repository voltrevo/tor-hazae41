import { Handshake } from '../handshake.js';
import { Bytes } from '../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../cursor/index.js';

export class Finished2 {
  readonly #class = Finished2;

  static readonly handshake_type = Handshake.types.finished;

  constructor(readonly verify_data: Bytes) {}

  static new(verify_data: Bytes) {
    return new Finished2(verify_data);
  }

  get handshake_type() {
    return this.#class.handshake_type;
  }

  sizeOrThrow() {
    return this.verify_data.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.verify_data);
  }

  static readOrThrow(cursor: Cursor) {
    return new Finished2(cursor.readAndCopyOrThrow(cursor.remaining));
  }
}
