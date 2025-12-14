import { Cursor } from '@hazae41/cursor';
import { Handshake } from '../../../../../mods/binary/records/handshakes/handshake.js';

export class Finished2 {
  readonly #class = Finished2;

  static readonly handshake_type = Handshake.types.finished;

  constructor(readonly verify_data: Uint8Array) {}

  static new(verify_data: Uint8Array) {
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
