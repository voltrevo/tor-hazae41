import { Cursor } from '../../../../../../../cursor';
import { Unimplemented } from '../../../../errors';
import { Bytes } from '../../../../../../../bytes';

export class PaddingCell {
  readonly #class = PaddingCell;

  static readonly circuit = false;
  static readonly command = 0;

  constructor(readonly data: Bytes) {}

  get command() {
    return this.#class.command;
  }

  sizeOrThrow(): never {
    throw new Unimplemented();
  }

  writeOrThrow(_cursor: Cursor): never {
    throw new Unimplemented();
  }

  static readOrThrow(cursor: Cursor) {
    return new PaddingCell(cursor.readAndCopyOrThrow(cursor.remaining));
  }
}
