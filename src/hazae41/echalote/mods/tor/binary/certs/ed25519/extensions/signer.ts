import { Bytes } from '../../../../../../../bytes';
import { Cursor } from '../../../../../../../cursor/mod';

export class SignedWithEd25519Key {
  readonly #class = SignedWithEd25519Key;

  static readonly type = 4;

  constructor(readonly key: Bytes<32>) {}

  get type(): 4 {
    return this.#class.type;
  }

  static readOrThrow(cursor: Cursor) {
    return new SignedWithEd25519Key(cursor.readAndCopyOrThrow(32));
  }
}
